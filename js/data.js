/* Data loading & live feeds */
const DataStore = {
  airports: null,          // GeoJSON FeatureCollection
  runwaysByIdent: {},      // { ident: [rwy, ...] }
  traffic: [],             // current aircraft states
  tfrs: [],                // TFR list
  lastUpdate: null,
  loading: { airports: false, traffic: false, tfrs: false },

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
      // OpenSky often blocks CORS from browsers; attempt + fallback
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(`OpenSky ${res.status}`);
      const json = await res.json();
      // states is array of arrays: [icao24, callsign, origin_country, time_position, last_contact, lon, lat, baro_altitude, on_ground, velocity, true_track, vertical_rate, ...]
      this.traffic = (json.states || []).filter(s => s[5] != null && s[6] != null).map(s => ({
        icao24: s[0],
        callsign: (s[1] || '').trim(),
        country: s[2],
        lon: s[5],
        lat: s[6],
        alt: s[7],          // baro altitude meters
        onGround: s[8],
        velocity: s[9],     // m/s
        track: s[10],       // degrees
        vrate: s[11],
        squawk: s[14],
        category: s[17]
      }));
      console.log(`[Data] Traffic: ${this.traffic.length} aircraft`);
    } catch (e) {
      console.warn('[Data] Traffic unavailable (CORS or rate limit). OpenSky requires non-browser or feeder account for reliable access.', e.message);
      this.traffic = [];
    } finally {
      this.loading.traffic = false;
      this.lastUpdate = new Date();
    }
  },

  async fetchTFRs() {
    this.loading.tfrs = true;
    try {
      const res = await fetch(CONFIG.tfrList, { mode: 'cors' });
      if (!res.ok) throw new Error(`TFR ${res.status}`);
      const data = await res.json();
      // Expected shape varies; normalize
      this.tfrs = Array.isArray(data) ? data : (data.tfrs || data.items || []);
      console.log(`[Data] TFRs: ${this.tfrs.length}`);
    } catch (e) {
      console.warn('[Data] TFR list unavailable (CORS). Falling back to empty. See README for proxy options.', e.message);
      this.tfrs = [];
    } finally {
      this.loading.tfrs = false;
      this.lastUpdate = new Date();
    }
  },

  async fetchMetar(icaoList) {
    if (!icaoList || !icaoList.length) return [];
    const ids = icaoList.slice(0, 20).join(','); // limit
    const url = `${CONFIG.metarApi}?ids=${ids}&format=json`;
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(`METAR ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn('[Data] METAR fetch failed', e.message);
      return [];
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
