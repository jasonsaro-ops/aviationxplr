/* Data loading & live feeds */
const DataStore = {
  airports: null,          // GeoJSON FeatureCollection
  runwaysByIdent: {},      // { ident: [rwy, ...] }
  traffic: [],             // current aircraft states
  tfrs: [],                // TFR list
  wxbriefMetars: [],       // from 1800wxbrief metaf
  wxbriefTfrs: [],
  pireps: [],
  sigmets: [],         // from 1800wxbrief with geometry
  lastUpdate: null,
  loading: { airports: false, traffic: false, tfrs: false },

  /** Fetch via CORS proxy (with fallback) so browser can reach OpenSky / FAA / AWC */


  async proxiedFetch(targetUrl) {
    const strategies = [];

    // 1) User-deployed Cloudflare Worker (reliable)
    if (CONFIG.corsWorker) {
      strategies.push(async (u) => {
        const res = await fetch(CONFIG.corsWorker.replace(/\/$/, '') + '?url=' + encodeURIComponent(u));
        if (!res.ok) throw new Error('worker ' + res.status);
        return res;
      });
    }

    // 2) Public fallbacks (often rate-limited / blocked)
    strategies.push(async (u) => {
      const res = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(u) + '&disableCache=true');
      if (!res.ok) throw new Error('allorigins ' + res.status);
      const j = await res.json();
      const body = j.contents;
      if (body == null) throw new Error('allorigins empty');
      return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    strategies.push(async (u) => {
      const res = await fetch('https://corsproxy.org/?' + encodeURIComponent(u));
      if (!res.ok) throw new Error('corsproxy.org ' + res.status);
      return res;
    });
    strategies.push(async (u) => {
      const res = await fetch(u, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('direct ' + res.status);
      return res;
    });

    let lastErr;
    for (const fn of strategies) {
      try {
        return await fn(targetUrl);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('All proxy strategies failed');
  },

  async loadAirports() {
    this.loading.airports = true;
    try {
      const res = await fetch(CONFIG.airportsGeoJSON);
      if (!res.ok) throw new Error('Airports fetch failed');
      this.airports = await res.json();
      console.log(`[Data] Loaded ${this.airports.features.length} US airports`);
    } catch (e) {
      console.error('[Data] Airports error', e);
      this.airports = { type: 'FeatureCollection', features: [] };
    } finally {
      this.loading.airports = false;
    }
  },

  async loadRunways() {
    try {
      const res = await fetch(CONFIG.runwaysJSON);
      if (!res.ok) throw new Error('Runways fetch failed');
      this.runwaysByIdent = await res.json();
      console.log(`[Data] Loaded runways for ${Object.keys(this.runwaysByIdent).length} idents`);
    } catch (e) {
      console.error('[Data] Runways error', e);
      this.runwaysByIdent = {};
    }
  },

  


  async fetchTraffic() {
    this.loading.traffic = true;
    const byHex = new Map();
    let grid = CONFIG.trafficGrid || [{ lat: 40, lon: -75 }];
    let nm = Math.min(CONFIG.trafficRadiusNm || 100, 150);
    // Viewport-centered query for dense, moving traffic under the camera
    if (this._viewportQuery) {
      const v = this._viewportQuery;
      grid = [{ lat: v.lat, lon: v.lon }, ...grid.slice(0, 6)];
      nm = v.nm || nm;
    }

    const ingest = (list) => {
      (list || []).forEach(a => {
        if (a.lat == null || a.lon == null) return;
        const hex = String(a.hex || a.icao24 || '').toLowerCase();
        if (!hex || byHex.has(hex)) return;
        const altFt = a.alt_baro === 'ground' ? 0 : (a.alt_baro != null ? Number(a.alt_baro) : (a.alt_geom != null ? Number(a.alt_geom) : null));
        byHex.set(hex, {
          icao24: hex,
          callsign: String(a.flight || a.callsign || '').trim(),
          reg: a.r || '',
          type: a.t || a.desc || '',
          lon: a.lon,
          lat: a.lat,
          alt: altFt != null ? altFt * 0.3048 : null,
          onGround: a.alt_baro === 'ground',
          velocity: a.gs != null ? Number(a.gs) * 0.514444 : null,
          track: a.track != null ? Number(a.track) : null,
          vrate: a.baro_rate != null ? Number(a.baro_rate) * 0.00508 : null,
          squawk: a.squawk || '',
          category: a.category || '',
          source: 'planes.fyi'
        });
      });
    };

    // Primary: planes.fyi direct (CORS-enabled)
    const pfJobs = grid.map(async (pt) => {
      const url = (CONFIG.planesFyiOverhead || '')
        .replace('{lat}', pt.lat)
        .replace('{lon}', pt.lon)
        .replace('{nm}', nm);
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        ingest(json.ac || json.aircraft || []);
      } catch (e) {
        /* planes.fyi point miss */
      }
    });
    await Promise.allSettled(pfJobs);

    // Fallback only if planes.fyi returned nothing
    if (byHex.size === 0) {
      console.warn('[Data] planes.fyi empty — trying fallback ADS-B');
      for (const pt of grid.slice(0, 3)) {
        for (const tmpl of [CONFIG.adsbfiPoint, CONFIG.adsblolPoint]) {
          if (!tmpl) continue;
          try {
            const url = tmpl.replace('{lat}', pt.lat).replace('{lon}', pt.lon).replace('{nm}', 200);
            const res = await this.proxiedFetch(url);
            const json = await res.json();
            ingest(json.aircraft || json.ac || []);
          } catch (e) { /* quiet */ }
        }
        if (byHex.size > 0) break;
      }
    }

    this.traffic = Array.from(byHex.values());
    console.log('[Data] Traffic: ' + this.traffic.length + ' aircraft (planes.fyi)');
    this.loading.traffic = false;
    this.lastUpdate = new Date();
  },

  async fetchTFRs() {
    this.loading.tfrs = true;
    try {
      const res = await this.proxiedFetch(CONFIG.tfrList);
      const data = await res.json();
      this.tfrs = Array.isArray(data) ? data : (data.tfrs || data.items || data.data || []);
      console.log(`[Data] TFRs: ${this.tfrs.length}`);
    } catch (e) {
      console.warn('[Data] TFR list unavailable:', e.message);
      this.tfrs = [];
    } finally {
      this.loading.tfrs = false;
      this.lastUpdate = new Date();
    }
  },

  async fetchMetar(icaoList) {
    if (!icaoList || !icaoList.length) return [];
    const ids = icaoList.slice(0, 15).join(',');
    const url = `${CONFIG.metarApi}?ids=${ids}&format=json`;
    try {
      const res = await this.proxiedFetch(url);
      const data = await res.json();
      // AWC sometimes returns array, sometimes object
      return Array.isArray(data) ? data : (data.data || data.metar || [data]);
    } catch (e) {
      console.warn('[Data] METAR fetch failed:', e.message);
      return [];
    }
  },


  async fetchWxBrief() {
    const b = CONFIG.wxbriefBbox;
    const ext = `${b.west},${b.south},${b.east},${b.north}`;
    const time = Math.floor(Date.now() / 1000);
    const url = `${CONFIG.wxbriefDataLayer}?ext=${ext}&size=1400,900&center=${(b.west+b.east)/2},${(b.south+b.north)/2}&zoom=5&res=5000&ver=1&layers=${CONFIG.wxbriefLayers}&time=${time}&baseTypes=all&app=pw&rand=${Math.floor(Math.random()*99999)}`;
    try {
      // Prefer direct (same-origin policy may allow; else proxy)
      let res;
      try {
        res = await fetch(url, { headers: { 'Accept': 'application/json' }, referrer: 'https://www.1800wxbrief.com/Website/interactiveMap' });
        if (!res.ok) throw new Error('direct ' + res.status);
      } catch (e1) {
        res = await this.proxiedFetch(url);
      }
      const json = await res.json();
      const layers = json.l || [];
      this.wxbriefMetars = layers.filter(x => x.type === 'metaf');
      this.wxbriefTfrs = layers.filter(x => String(x.type || '').startsWith('tfr'));
      // Also merge TFR list for counts
      this.tfrs = this.wxbriefTfrs.map(t => ({
        notam: t.notamid,
        NOTAM: t.notamid,
        description: t.notamHoverText || '',
        msg: t.msg,
        from: t.from,
        to: t.to,
        type: t.type,
        geometry: t.g
      }));
      console.log(`[Data] 1800WXBRIEF: ${this.wxbriefMetars.length} METARs, ${this.wxbriefTfrs.length} TFRs`);
    } catch (e) {
      console.warn('[Data] 1800WXBRIEF dataLayer failed:', e.message);
      this.wxbriefMetars = [];
      this.wxbriefTfrs = [];
    } finally {
      this.lastUpdate = new Date();
    }
  },


  async fetchPireps() {
    // AviationWeather PIREPs last 2 hours, Americas bbox via proxy
    const url = 'https://aviationweather.gov/api/data/pirep?format=json&age=2';
    try {
      const res = await this.proxiedFetch(url);
      const data = await res.json();
      this.pireps = Array.isArray(data) ? data : (data.data || []);
      console.log('[Data] PIREPs', this.pireps.length);
    } catch (e) {
      console.warn('[Data] PIREP failed', e.message);
      this.pireps = [];
    }
  },

  async fetchSigmets() {
    const url = 'https://aviationweather.gov/api/data/airsigmet?format=json';
    try {
      const res = await this.proxiedFetch(url);
      const data = await res.json();
      this.sigmets = Array.isArray(data) ? data : (data.data || []);
      console.log('[Data] SIGMETs', this.sigmets.length);
    } catch (e) {
      console.warn('[Data] SIGMET failed', e.message);
      this.sigmets = [];
    }
  },


  async loadFrequencies() {
    try {
      const res = await fetch(CONFIG.frequenciesJSON);
      this.frequencies = await res.json();
      console.log('[Data] Frequencies loaded for', Object.keys(this.frequencies).length, 'idents');
    } catch (e) {
      console.warn('[Data] Frequencies load failed', e);
      this.frequencies = {};
    }
  },

  getFrequencies(ident) {
    if (!this.frequencies || !ident) return [];
    const key = String(ident).toUpperCase();
    return this.frequencies[key] || this.frequencies[key.replace(/^K/, '')] || [];
  },

  getRunways(ident) {
    return this.runwaysByIdent[ident] || this.runwaysByIdent[ident?.toUpperCase()] || [];
  },

  searchAirports(q) {
    if (!this.airports || !q || q.length < 1) return [];
    const term = q.toUpperCase().trim();
    const results = [];
    for (const f of this.airports.features) {
      const p = f.properties;
      const hay = `${p.ident || ''} ${p.icao || ''} ${p.iata || ''} ${p.name || ''} ${p.municipality || ''}`.toUpperCase();
      if (hay.includes(term)) {
        results.push(f);
        if (results.length >= 25) break;
      }
    }
    // Prefer exact ident/icao/iata matches first
    results.sort((a, b) => {
      const pa = a.properties, pb = b.properties;
      const score = (p) => {
        if (p.ident === term || p.icao === term || p.iata === term) return 0;
        if ((p.ident || '').startsWith(term) || (p.icao || '').startsWith(term)) return 1;
        return 2;
      };
      return score(pa) - score(pb);
    });
    return results;
  }
};
