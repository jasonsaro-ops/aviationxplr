/* Data loading & live feeds */
const DataStore = {
  airports: null,          // GeoJSON FeatureCollection
  runwaysByIdent: {},      // { ident: [rwy, ...] }
  traffic: [],             // current aircraft states
  tfrs: [],                // TFR list
  wxbriefMetars: [],       // from 1800wxbrief metaf
  wxbriefTfrs: [],         // from 1800wxbrief with geometry
  lastUpdate: null,
  loading: { airports: false, traffic: false, tfrs: false },

  /** Fetch via CORS proxy (with fallback) so browser can reach OpenSky / FAA / AWC */
  async proxiedFetch(targetUrl) {
    const proxies = [
      (u) => CONFIG.corsProxy + encodeURIComponent(u),
      (u) => CONFIG.corsProxyFallback + encodeURIComponent(u),
      (u) => u // last resort: direct (may fail CORS)
    ];
    let lastErr;
    for (const build of proxies) {
      try {
        const res = await fetch(build(targetUrl), {
          method: 'GET',
          headers: { 'Accept': 'application/json, text/plain, */*' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
      } catch (e) {
        lastErr = e;
        console.warn('[Data] Proxy attempt failed:', e.message);
      }
    }
    throw lastErr || new Error('All fetch attempts failed');
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
    const { lamin, lomin, lamax, lomax } = CONFIG.openskyBbox;
    const url = `${CONFIG.openskyStates}?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
    try {
      const res = await this.proxiedFetch(url);
      const json = await res.json();
      // states: [icao24, callsign, origin_country, time_position, last_contact, lon, lat, baro_altitude, on_ground, velocity, true_track, vertical_rate, ...]
      this.traffic = (json.states || []).filter(s => s[5] != null && s[6] != null).map(s => ({
        icao24: s[0],
        callsign: (s[1] || '').trim(),
        country: s[2],
        lon: s[5],
        lat: s[6],
        alt: s[7],
        onGround: s[8],
        velocity: s[9],
        track: s[10],
        vrate: s[11],
        squawk: s[14],
        category: s[17]
      }));
      console.log(`[Data] Traffic: ${this.traffic.length} aircraft`);
    } catch (e) {
      console.warn('[Data] Traffic unavailable:', e.message);
      this.traffic = [];
    } finally {
      this.loading.traffic = false;
      this.lastUpdate = new Date();
    }
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
