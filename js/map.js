/* Map, layers, markers — worldwide AviationXplr */
const MapApp = {
  map: null,
  layers: {
    airports: null,
    runways: null,
    tfrs: null,
    metar: null,
    artcc: null,
    tracon: null,
    towers: null,
    pireps: null,
    sigmets: null,
    radar: null,
    airspace: null,
    metarDots: null
  },
  airportIndex: {},
  filters: {
    large: true, medium: true, small: false, heli: false, seaplane: false, scheduled: false
  },
  _radarFrames: [],
  _radarTimer: null,
  _radarIdx: 0,

  init() {
    this.map = L.map('map', {
      center: CONFIG.defaultCenter,
      zoom: CONFIG.defaultZoom,
      minZoom: CONFIG.minZoom,
      maxZoom: CONFIG.maxZoom,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: false
    });

    const tileOpts = (url, attr, nativeZ, maxZ) => L.tileLayer(url, {
      attribution: attr || '',
      maxZoom: maxZ || 18,
      maxNativeZoom: nativeZ || 16,
      errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    });
    const esriDark = tileOpts(CONFIG.tiles.dark.url, CONFIG.tiles.dark.attribution, 16, 18);
    const esriLabels = L.tileLayer(CONFIG.tiles.darkLabels.url, {
      attribution: '', maxZoom: 18, maxNativeZoom: 16, opacity: 0.85
    });
    const esriImagery = tileOpts(CONFIG.tiles.imagery.url, CONFIG.tiles.imagery.attribution, 19, 19);
    const esriTopo = tileOpts(CONFIG.tiles.topo.url, CONFIG.tiles.topo.attribution, 19, 19);
    const esriStreets = tileOpts(CONFIG.tiles.streets.url, CONFIG.tiles.streets.attribution, 19, 19);
    const osm = tileOpts(CONFIG.tiles.osm.url, CONFIG.tiles.osm.attribution, 19, 19);

    const darkGroup = L.layerGroup([esriDark, esriLabels]);
    darkGroup.addTo(this.map);

    this._basemaps = {
      'Dark Gray': darkGroup,
      'Satellite': esriImagery,
      'Topographic': esriTopo,
      'Streets': esriStreets,
      'OpenStreetMap': osm
    };

    // Overlay layers
    this.layers.airports = L.layerGroup();
    this.layers.runways = L.layerGroup();
    this.layers.tfrs = L.layerGroup();
    this.layers.metar = L.layerGroup();
    this.layers.artcc = L.layerGroup();
    this.layers.tracon = L.layerGroup();
    this.layers.towers = L.layerGroup();
    this.layers.pireps = L.layerGroup();
    this.layers.sigmets = L.layerGroup();
    this.layers.radar = L.layerGroup();
    this.layers.airspace = L.layerGroup();
    this.layers.metarDots = L.layerGroup();
    // FAA-style VFR sectional tiles (US coverage; free ArcGIS)
    this.layers.sectional = L.tileLayer(
      'https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 15, maxNativeZoom: 12, opacity: 1, attribution: 'FAA VFR Sectional', zIndex: 300 }
    );
    this.layers.ifrlow = L.tileLayer(
      'https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/IFR_Low/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 14, maxNativeZoom: 10, opacity: 1, attribution: 'FAA IFR Low', zIndex: 300 }
    );
    this.layers.ifrhigh = L.tileLayer(
      'https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/IFR_High/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 13, maxNativeZoom: 9, opacity: 1, attribution: 'FAA IFR High', zIndex: 300 }
    );

    this.map.addLayer(this.layers.airports);
    this.map.addLayer(this.layers.runways);

    const overlays = {
      'Airports': this.layers.airports,
      'Runways': this.layers.runways,
      'Weather Radar': this.layers.radar,
      'VFR Sectional': this.layers.sectional,
      'IFR Low': this.layers.ifrlow,
      'IFR High': this.layers.ifrhigh,
      'ARTCC / ACC': this.layers.artcc,
      'TRACON': this.layers.tracon,
      'Control Towers': this.layers.towers
    };
    L.control.layers(this._basemaps, overlays, { position: 'topright', collapsed: true }).addTo(this.map);

    // When radar overlay toggled via Leaflet control, start/stop loop
    this.map.on('overlayadd', (e) => {
      if (e.name === 'Weather Radar') this.startRadarLoop();
      if (e.name === 'VFR Sectional') { /* static tiles */ }
    });
    this.map.on('overlayremove', (e) => {
      if (e.name === 'Weather Radar') this.stopRadarLoop();
    });

    this.buildArtccLayer();
    this.buildTraconLayer();
    this.buildTowerLayer();
    this.initRadar();

    
    // Sidebar layer toggles — fetch/build on enable
    const onToggle = async (id, layer, activator) => {
      const el = document.getElementById(id);
      if (!el) return;
      const apply = async () => {
        if (el.checked) {
          if (activator) await activator();
          if (layer && !this.map.hasLayer(layer)) this.map.addLayer(layer);
        } else {
          if (layer && this.map.hasLayer(layer)) this.map.removeLayer(layer);
          if (id === 'lyr-radar') this.stopRadarLoop();
        }
      };
      el.addEventListener('change', apply);
      // Apply initial state for checked boxes
      if (el.checked) apply();
    };

    onToggle('lyr-airports', this.layers.airports);
    onToggle('lyr-runways', this.layers.runways);
    onToggle('lyr-radar', this.layers.radar, async () => { await this.initRadar(); this.startRadarLoop(); });
    onToggle('lyr-sectional', this.layers.sectional);
    onToggle('lyr-tfrs', this.layers.tfrs, async () => {
      await DataStore.fetchTFRs();
      this.renderTFRs();
    });
    onToggle('lyr-metar', this.layers.metarDots, async () => {
      await this.loadMetarStations();
    });
    onToggle('lyr-pirep', this.layers.pireps, async () => {
      await DataStore.fetchPireps();
      this.renderPireps();
    });
    onToggle('lyr-sigmet', this.layers.sigmets, async () => {
      await DataStore.fetchSigmets();
      this.renderSigmets();
    });
    onToggle('lyr-airspace', this.layers.airspace, async () => {
      this.buildAirspaceLayer();
    });
    onToggle('lyr-artcc', this.layers.artcc, async () => {
      this.buildArtccLayer();
    });
    onToggle('lyr-tracon', this.layers.tracon, async () => {
      this.buildTraconLayer();
    });
    onToggle('lyr-towers', this.layers.towers, async () => {
      this.buildTowerLayer();
    });

    // Filters
    // Filters
    ['large','medium','small','heli','seaplane','scheduled'].forEach(key => {
      const id = key === 'heli' ? 'flt-heli' : (key === 'seaplane' ? 'flt-seaplane' : (key === 'scheduled' ? 'flt-scheduled' : 'flt-' + key));
      const el = document.getElementById(id);
      if (!el) return;
      this.filters[key === 'heli' ? 'heli' : key] = el.checked;
      el.addEventListener('change', () => {
        this.filters.large = !!document.getElementById('flt-large')?.checked;
        this.filters.medium = !!document.getElementById('flt-medium')?.checked;
        this.filters.small = !!document.getElementById('flt-small')?.checked;
        this.filters.heli = !!document.getElementById('flt-heli')?.checked;
        this.filters.seaplane = !!document.getElementById('flt-seaplane')?.checked;
        this.filters.scheduled = !!document.getElementById('flt-scheduled')?.checked;
        this.renderAirports();
      });
    });

    document.getElementById('btn-fit-americas')?.addEventListener('click', () => {
      this.map.setView(CONFIG.defaultCenter, CONFIG.defaultZoom);
    });
    document.getElementById('btn-fit-world')?.addEventListener('click', () => {
      this.map.setView([20, 0], 2);
    });

    setTimeout(() => { try { this.map.invalidateSize(); } catch (e) {} }, 200);
  },


  

  atcIcon(p, withLabel) {
    const type = p.type || '';
    const label = (p.icao || p.ident || '').toUpperCase().substring(0, 4);
    // Classic ATC: aircraft = triangle, airport = square, fix = triangle outline
    let inner = '';
    let box = 16;
    if (type === 'large_airport') {
      // Filled square + brightness (primary field)
      inner = '<rect x="4" y="4" width="8" height="8" fill="#33ff66"/>';
    } else if (type === 'medium_airport') {
      inner = '<rect x="4" y="4" width="8" height="8" fill="none" stroke="#33ff66" stroke-width="1.8"/>';
    } else if (type === 'heliport') {
      inner = '<circle cx="8" cy="8" r="6" fill="none" stroke="#88ffaa" stroke-width="1.4"/>' +
        '<text x="8" y="11" text-anchor="middle" font-size="8" font-family="monospace" font-weight="700" fill="#88ffaa">H</text>';
    } else if (type === 'seaplane_base') {
      inner = '<path d="M2 5 L8 13 L14 5" fill="none" stroke="#44ddaa" stroke-width="1.6"/>';
    } else {
      // small — diamond (rotated square)
      inner = '<path d="M8 2 L14 8 L8 14 L2 8 Z" fill="none" stroke="#22aa44" stroke-width="1.4"/>';
    }
    const tag = (withLabel && label)
      ? '<span class="atc-tag">' + label + '</span>'
      : '';
    const html = '<div class="atc-sym"><svg width="16" height="16" viewBox="0 0 16 16" overflow="visible">' +
      inner + '</svg>' + tag + '</div>';
    return L.divIcon({
      className: 'atc-marker',
      html: html,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
  },


sectionalIcon(p) {
    const type = p.type || '';
    const scheduled = !!p.scheduled;
    const mag = '#e0208a';
    const cyan = '#00d4ff';
    let size = 14;
    let svg = '';
    if (type === 'large_airport') {
      size = 18;
      svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24">' +
        '<circle cx="12" cy="12" r="7" fill="' + mag + '" stroke="' + mag + '" stroke-width="1.5"/>' +
        '<circle cx="12" cy="12" r="3" fill="#0a0e14"/>' +
        '<line x1="12" y1="2" x2="12" y2="6" stroke="' + mag + '" stroke-width="2"/>' +
        '<line x1="12" y1="18" x2="12" y2="22" stroke="' + mag + '" stroke-width="2"/>' +
        '<line x1="2" y1="12" x2="6" y2="12" stroke="' + mag + '" stroke-width="2"/>' +
        '<line x1="18" y1="12" x2="22" y2="12" stroke="' + mag + '" stroke-width="2"/>' +
        '</svg>';
    } else if (type === 'medium_airport') {
      size = 16;
      const fill = scheduled ? mag : 'none';
      svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24">' +
        '<circle cx="12" cy="12" r="6.5" fill="' + fill + '" stroke="' + mag + '" stroke-width="2"/>' +
        '<line x1="12" y1="3" x2="12" y2="7" stroke="' + mag + '" stroke-width="1.8"/>' +
        '<line x1="12" y1="17" x2="12" y2="21" stroke="' + mag + '" stroke-width="1.8"/>' +
        '<line x1="3" y1="12" x2="7" y2="12" stroke="' + mag + '" stroke-width="1.8"/>' +
        '<line x1="17" y1="12" x2="21" y2="12" stroke="' + mag + '" stroke-width="1.8"/>' +
        '</svg>';
    } else if (type === 'heliport') {
      size = 14;
      svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24">' +
        '<circle cx="12" cy="12" r="9" fill="none" stroke="' + mag + '" stroke-width="1.5"/>' +
        '<text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" font-family="sans-serif" fill="' + mag + '">H</text>' +
        '</svg>';
    } else if (type === 'seaplane_base') {
      size = 14;
      svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24">' +
        '<path d="M6 14 Q12 8 18 14" fill="none" stroke="' + cyan + '" stroke-width="2"/>' +
        '<path d="M5 17 Q12 12 19 17" fill="none" stroke="' + cyan + '" stroke-width="1.5"/>' +
        '<circle cx="12" cy="10" r="2" fill="' + cyan + '"/>' +
        '</svg>';
    } else {
      size = 10;
      svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24">' +
        '<circle cx="12" cy="12" r="7" fill="none" stroke="' + mag + '" stroke-width="2.2"/>' +
        '</svg>';
    }
    return L.divIcon({
      className: 'sec-apt-icon',
      html: svg,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  },

  typeAllowed(type) {
    if (type === 'large_airport') return this.filters.large;
    if (type === 'medium_airport') return this.filters.medium;
    if (type === 'small_airport') return this.filters.small;
    if (type === 'heliport') return this.filters.heli;
    if (type === 'seaplane_base') return this.filters.seaplane;
    return false;
  },


  renderAirports() {
    // Full rebuild only stores features; actual paint is viewport-based
    if (!DataStore.airports || !DataStore.airports.features) return;
    this._allFeatures = null; // rebuild filtered list
    this.paintVisibleAirports(true);
    if (!this._viewportBound) {
      this._viewportBound = true;
      let t = null;
      this.map.on('moveend', () => {
        clearTimeout(t);
        t = setTimeout(() => this.paintVisibleAirports(false), 120);
      });
      this.map.on('zoomend', () => {
        clearTimeout(t);
        t = setTimeout(() => this.paintVisibleAirports(false), 120);
      });
    }
  },

  _filteredFeatures() {
    if (this._allFeatures) return this._allFeatures;
    const out = [];
    const feats = DataStore.airports.features;
    for (let i = 0; i < feats.length; i++) {
      const f = feats[i];
      const p = f.properties;
      if (!this.typeAllowed(p.type)) continue;
      if (this.filters.scheduled && !p.scheduled) continue;
      out.push(f);
    }
    this._allFeatures = out;
    return out;
  },

  paintVisibleAirports(forceClear) {
    if (!DataStore.airports) return;
    const bounds = this.map.getBounds().pad(0.15);
    const zoom = this.map.getZoom();
    const list = this._filteredFeatures();

    // Cap density by zoom
    let maxPts = 2500;
    if (zoom <= 3) maxPts = 400;
    else if (zoom <= 5) maxPts = 900;
    else if (zoom <= 7) maxPts = 1800;
    else if (zoom <= 9) maxPts = 3000;
    else maxPts = 5000;

    if (forceClear || !this.layers.airports) {
      this.layers.airports.clearLayers();
      this.airportIndex = {};
    } else {
      this.layers.airports.clearLayers();
      this.airportIndex = {};
    }

    const visible = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const c = f.geometry.coordinates;
      if (bounds.contains([c[1], c[0]])) visible.push(f);
    }

    // Thin if too many
    let draw = visible;
    if (visible.length > maxPts) {
      const step = Math.ceil(visible.length / maxPts);
      draw = [];
      for (let i = 0; i < visible.length; i += step) draw.push(visible[i]);
    }

    const self = this;
    const showLabels = zoom >= 9;
    for (let i = 0; i < draw.length; i++) {
      const f = draw[i];
      const p = f.properties;
      const [lon, lat] = f.geometry.coordinates;
      const marker = L.marker([lat, lon], {
        icon: self.atcIcon(p, showLabels),
        interactive: true,
        keyboard: false
      });
      marker.feature = f;
      marker.on('click', () => {
        UI.showAirport(f);
        self.highlightRunways(p.ident);
      });
      self.layers.airports.addLayer(marker);
      self.airportIndex[p.ident] = marker;
    }
    UI.updateCounts({
      airports: draw.length,
      traffic: 0,
      tfrs: (DataStore.wxbriefTfrs || DataStore.tfrs || []).length
    });
    UI.setLive(true);
    UI.setLastUpdate(new Date());
  },

  highlightRunways(ident) {
    this.layers.runways.clearLayers();
    if (!ident) return;
    const rwys = DataStore.getRunways(ident) || [];
    rwys.forEach(r => {
      const geom = r.geometry;
      if (!geom || !geom.coordinates || geom.coordinates.length < 2) return;
      const coords = geom.coordinates.map(c => [c[1], c[0]]);
      const line = L.polyline(coords, {
        color: r.closed ? '#335544' : '#33ff66', weight: 4, opacity: 0.95, lineCap: 'butt'
      });
      const label = (r.le_ident || '?') + '/' + (r.he_ident || '?');
      line.bindTooltip(label + ' · ' + (r.length_ft || '?') + ' ft', { sticky: true, className: 'ax-tip' });
      line.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (UI.showRunway) UI.showRunway(r, ident);
      });
      this.layers.runways.addLayer(line);
      [coords[0], coords[coords.length - 1]].forEach((ll, i) => {
        const mk = L.circleMarker(ll, { radius: 4, color: '#33ff66', fillColor: '#001a0a', fillOpacity: 1, weight: 1.5 });
        mk.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (UI.showRunway) UI.showRunway(r, ident);
        });
        this.layers.runways.addLayer(mk);
      });
    });
  },

  showAirportCharts(feature) {
    // Charts stay off by default — user enables via panel buttons or layer control
    const [lon, lat] = feature.geometry.coordinates;
    this.map.setView([lat, lon], Math.max(this.map.getZoom(), 11), { animate: true });
  },

  focusAirport(feature) {
    const [lon, lat] = feature.geometry.coordinates;
    this.map.setView([lat, lon], 13, { animate: true });
    UI.showAirport(feature);
    this.highlightRunways(feature.properties.ident);
  },

  async initRadar() {
    // Prefer RainViewer animated frames (global)
    try {
      const res = await fetch(CONFIG.rainviewerMaps);
      const data = await res.json();
      const host = data.host || 'https://tilecache.rainviewer.com';
      const frames = (data.radar && data.radar.past) ? data.radar.past : [];
      const pastSlice = frames.slice(-8);
      this._radarFrames = pastSlice.map(f => {
        const path = typeof f.path === 'string' ? f.path : (f.path && f.path.path) || '';
        return {
          path,
          time: f.time,
          host,
          url: host + path + '/256/{z}/{x}/{y}/2/1_1.png'
        };
      }).filter(f => f.path);
      // also nowcast if present
      if (data.radar && data.radar.nowcast) {
        data.radar.nowcast.forEach(f => {
          this._radarFrames.push({
            path: f.path, time: f.time,
            url: host + f.path + '/256/{z}/{x}/{y}/2/1_1.png'
          });
        });
      }
      console.log('[Map] RainViewer frames', this._radarFrames.length);
    } catch (e) {
      console.warn('[Map] RainViewer failed, NEXRAD fallback', e.message);
      this._radarFrames = [];
    }
  },

  startRadarLoop() {
    this.stopRadarLoop();
    if (!this.map.hasLayer(this.layers.radar)) this.map.addLayer(this.layers.radar);

    const paint = () => {
      this.layers.radar.clearLayers();
      if (this._radarFrames && this._radarFrames.length) {
        const fr = this._radarFrames[this._radarIdx % this._radarFrames.length];
        const url = fr.url || ((fr.host || '') + (fr.path || '') + '/256/{z}/{x}/{y}/2/1_1.png');
        this.layers.radar.addLayer(L.tileLayer(url, {
          opacity: 0.65,
          attribution: 'Radar © RainViewer',
          maxZoom: 18,
          maxNativeZoom: 7,
          zIndex: 250
        }));
      } else {
        // Iowa State NEXRAD — overscale past native to avoid "zoom not supported"
        this.layers.radar.addLayer(L.tileLayer(CONFIG.nexradTile, {
          opacity: 0.6,
          attribution: 'NEXRAD · Iowa State',
          maxZoom: 18,
          maxNativeZoom: 8,
          zIndex: 250
        }));
      }
    };

    const run = () => {
      this._radarIdx = Math.max(0, (this._radarFrames.length || 1) - 1);
      paint();
      if (this._radarFrames.length > 1) {
        this._radarTimer = setInterval(() => {
          this._radarIdx = (this._radarIdx + 1) % this._radarFrames.length;
          paint();
        }, 700);
      }
    };

    if (!this._radarFrames.length) {
      this.initRadar().then(run);
    } else {
      run();
    }
  },

  stopRadarLoop() {
    if (this._radarTimer) clearInterval(this._radarTimer);
    this._radarTimer = null;
    this.layers.radar.clearLayers();
  },


  async loadMetarStations() {
    if (!this.layers.metarDots) this.layers.metarDots = L.layerGroup();
    this.layers.metarDots.clearLayers();
    const b = this.map.getBounds();
    const west = b.getWest(), south = b.getSouth(), east = b.getEast(), north = b.getNorth();
    let list = [];
    try {
      list = await DataStore.fetchMetarBbox(west, south, east, north);
    } catch (e) { console.warn(e); }
    if (!list.length && DataStore.airports) {
      const feats = (this._filteredFeatures && this._filteredFeatures()) || [];
      for (let i = 0; i < feats.length && list.length < 50; i++) {
        const p = feats[i].properties;
        if (p.type !== 'large_airport' && p.type !== 'medium_airport') continue;
        const c = feats[i].geometry.coordinates;
        if (b.contains([c[1], c[0]])) {
          list.push({ icaoId: p.icao || p.ident, lat: c[1], lon: c[0], name: p.name, rawOb: '' });
        }
      }
    }
    (list || []).forEach(m => {
      const lat = m.lat ?? m.latitude;
      const lon = m.lon ?? m.longitude;
      if (lat == null || lon == null) return;
      const mk = L.circleMarker([lat, lon], {
        radius: 4, color: '#33ff66', weight: 1, fillColor: '#0a3', fillOpacity: 0.75
      });
      const id = m.icaoId || m.station_id || m.icao || '';
      const raw = m.rawOb || m.raw_text || '';
      mk.bindTooltip((id + ' METAR').trim(), { className: 'ax-tip' });
      mk.on('click', () => {
        document.getElementById('panel-title').textContent = id + ' METAR';
        document.getElementById('panel-body').innerHTML =
          '<div class="metar-box">' + String(raw || id).replace(/</g, '&lt;') + '</div>';
        document.getElementById('info-panel').classList.remove('hidden');
      });
      this.layers.metarDots.addLayer(mk);
    });
    console.log('[Map] METAR markers', this.layers.metarDots.getLayers().length);
  },

  renderTFRs() {
    this.layers.tfrs.clearLayers();
    const source = (DataStore.wxbriefTfrs && DataStore.wxbriefTfrs.length)
      ? DataStore.wxbriefTfrs
      : (DataStore.tfrs || []);
    let drawn = 0;
    source.forEach((item) => {
      let geom = item.g || item.geometry || item.geom;
      if (!geom && item.lat != null && item.lon != null) {
        // point TFR — draw circle
        const r = (item.radiusNm || item.radius || 5) * 1852;
        const c = L.circle([item.lat, item.lon], {
          radius: r, color: '#ff4060', fillColor: '#ff4060', fillOpacity: 0.2, weight: 2
        });
        c.bindTooltip(item.notam || item.NOTAM || 'TFR', { className: 'ax-tip' });
        c.on('click', () => UI.showTFR && UI.showTFR(item));
        this.layers.tfrs.addLayer(c);
        drawn++;
        return;
      }
      if (!geom) return;
      try {
        if (typeof geom === 'string') geom = JSON.parse(geom);
        const color = (item.type === 'tfrp' || item.type === 'TFR') ? '#ff4060' : '#ff6080';
        const layer = L.geoJSON(geom, { style: { color, fillColor: color, fillOpacity: 0.22, weight: 2 } });
        layer.bindTooltip(item.notam || item.NOTAM || item.id || 'TFR', { className: 'ax-tip' });
        layer.on('click', () => UI.showTFR && UI.showTFR(item));
        this.layers.tfrs.addLayer(layer);
        drawn++;
      } catch (e) {}
    });
    // If no polygons, place markers for list-only TFRs near facility ARTCC if known
    if (drawn === 0 && source.length) {
      const facilityXY = {
        ZNY: [40.78, -73.1], ZBW: [42.36, -71.06], ZDC: [38.85, -77.04],
        ZOB: [41.4, -81.85], ZAU: [41.98, -87.9], ZID: [39.87, -84.2],
        ZTL: [33.64, -84.43], ZJX: [30.5, -81.7], ZMA: [25.8, -80.3],
        ZHU: [29.98, -95.34], ZME: [35.04, -89.98], ZKC: [39.3, -94.71],
        ZMP: [44.88, -93.22], ZDV: [39.86, -104.67], ZAB: [35.04, -106.61],
        ZLA: [33.94, -118.4], ZOA: [37.62, -122.38], ZSE: [47.45, -122.3],
        ZLC: [40.79, -111.98], ZFW: [32.9, -97.04], ZAN: [61.17, -150.0],
        ZHN: [21.32, -157.92]
      };
      source.forEach((item, i) => {
        const fac = item.facility || (item.raw && item.raw.facility);
        const xy = facilityXY[fac];
        if (!xy) return;
        // slight offset so multiple TFRs at same center don't stack perfectly
        const lat = xy[0] + (i % 5) * 0.08;
        const lon = xy[1] + (Math.floor(i / 5) % 5) * 0.08;
        const m = L.circleMarker([lat, lon], {
          radius: 7, color: '#ff4060', fillColor: '#ff2040', fillOpacity: 0.7, weight: 2
        });
        const label = item.notam || item.NOTAM || 'TFR';
        m.bindTooltip(label + ' · ' + (item.type || '') + ' · ' + (fac || ''), { className: 'ax-tip' });
        m.on('click', () => UI.showTFR && UI.showTFR(item));
        this.layers.tfrs.addLayer(m);
        drawn++;
      });
    }
    console.log('[Map] TFRs drawn', drawn);
  },

  renderPireps() {
    this.layers.pireps.clearLayers();
    (DataStore.pireps || []).forEach(p => {
      const lat = p.lat ?? p.latitude; const lon = p.lon ?? p.longitude;
      if (lat == null || lon == null) return;
      const m = L.circleMarker([lat, lon], { radius: 4, color: '#ffaa00', fillColor: '#ffaa00', fillOpacity: 0.8 });
      m.on('click', () => {
        document.getElementById('panel-title').textContent = 'PIREP';
        document.getElementById('panel-body').innerHTML = '<div class="metar-box">' + String(p.rawOb || p.raw_text || '').replace(/</g,'&lt;') + '</div>';
        document.getElementById('info-panel').classList.remove('hidden');
      });
      this.layers.pireps.addLayer(m);
    });
  },

  renderSigmets() {
    this.layers.sigmets.clearLayers();
    (DataStore.sigmets || []).forEach(s => {
      const geom = s.geometry;
      if (!geom) return;
      try {
        const layer = L.geoJSON(geom, { style: { color: '#ff6060', fillOpacity: 0.15, weight: 1.5 } });
        this.layers.sigmets.addLayer(layer);
      } catch (e) {}
    });
  },


  buildAirspaceLayer() {
    if (!this.layers.airspace) this.layers.airspace = L.layerGroup();
    this.layers.airspace.clearLayers();
    const classB = [
      { id: 'KPHL', lat: 39.872, lon: -75.241, r: 30 },
      { id: 'KJFK', lat: 40.64, lon: -73.779, r: 30 },
      { id: 'KEWR', lat: 40.692, lon: -74.169, r: 30 },
      { id: 'KBOS', lat: 42.364, lon: -71.005, r: 30 },
      { id: 'KORD', lat: 41.978, lon: -87.905, r: 30 },
      { id: 'KATL', lat: 33.637, lon: -84.428, r: 30 },
      { id: 'KLAX', lat: 33.942, lon: -118.408, r: 30 },
      { id: 'KSFO', lat: 37.619, lon: -122.375, r: 30 },
      { id: 'KDFW', lat: 32.897, lon: -97.038, r: 30 },
      { id: 'KDEN', lat: 39.856, lon: -104.674, r: 30 },
      { id: 'KMIA', lat: 25.795, lon: -80.287, r: 30 },
      { id: 'KSEA', lat: 47.45, lon: -122.309, r: 30 },
      { id: 'KIAD', lat: 38.944, lon: -77.456, r: 30 },
      { id: 'KDCA', lat: 38.852, lon: -77.037, r: 20 },
      { id: 'KCLT', lat: 35.214, lon: -80.943, r: 30 },
      { id: 'KDTW', lat: 42.212, lon: -83.353, r: 30 },
      { id: 'KMSP', lat: 44.882, lon: -93.222, r: 30 },
      { id: 'KPHX', lat: 33.434, lon: -112.012, r: 30 },
      { id: 'KLAS', lat: 36.08, lon: -115.152, r: 30 },
      { id: 'KSLC', lat: 40.788, lon: -111.978, r: 30 }
    ];
    const classC = [
      { id: 'KSYR', lat: 43.111, lon: -76.106, r: 10 },
      { id: 'KTPA', lat: 27.975, lon: -82.533, r: 10 },
      { id: 'KMCO', lat: 28.429, lon: -81.309, r: 10 },
      { id: 'KSAN', lat: 32.733, lon: -117.189, r: 10 },
      { id: 'KPDX', lat: 45.589, lon: -122.597, r: 10 },
      { id: 'KSTL', lat: 38.749, lon: -90.37, r: 10 },
      { id: 'KPIT', lat: 40.492, lon: -80.233, r: 10 }
    ];
    const nm = 1852;
    classB.forEach(a => {
      const c = L.circle([a.lat, a.lon], {
        radius: a.r * nm, color: '#33ff66', weight: 1.2, dashArray: '4 6',
        fillColor: '#33ff66', fillOpacity: 0.04
      });
      c.bindTooltip(a.id + ' Class B (approx)', { className: 'ax-tip' });
      this.layers.airspace.addLayer(c);
    });
    classC.forEach(a => {
      const c = L.circle([a.lat, a.lon], {
        radius: a.r * nm, color: '#88ffaa', weight: 1, dashArray: '2 4',
        fillColor: '#88ffaa', fillOpacity: 0.03
      });
      c.bindTooltip(a.id + ' Class C (approx)', { className: 'ax-tip' });
      this.layers.airspace.addLayer(c);
    });
    console.log('[Map] Airspace rings', this.layers.airspace.getLayers().length);
  },

  buildArtccLayer() {
    if (typeof AirspaceData === 'undefined') return;
    this.layers.artcc.clearLayers();
    const centers = [...(AirspaceData.artcc || []), ...(AirspaceData.canadaAcc || []), ...(AirspaceData.latamAcc || [])];
    centers.forEach(c => {
      const m = L.circleMarker([c.lat, c.lon], { radius: 6, color: '#33ff66', weight: 1.5, fillColor: '#1a5', fillOpacity: 0.9 });
      m.bindTooltip(c.id + ' · ' + c.name, { className: 'ax-tip' });
      m.on('click', () => {
        let html = '<div class="meta-grid"><span class="label">Facility</span><span class="value">' + c.id + '</span>' +
          '<span class="label">Name</span><span class="value">' + c.name + '</span></div>';
        if (UI.freqTableHtml) html += UI.freqTableHtml(c.id);
        document.getElementById('panel-title').textContent = c.id + ' · ' + c.name;
        document.getElementById('panel-body').innerHTML = html;
        document.getElementById('info-panel').classList.remove('hidden');
      });
      this.layers.artcc.addLayer(m);
    });
  },

  buildTraconLayer() {
    if (typeof AirspaceData === 'undefined') return;
    this.layers.tracon.clearLayers();
    const nmToM = 1852;
    (AirspaceData.tracon || []).forEach(t => {
      const circle = L.circle([t.lat, t.lon], {
        radius: (t.radiusNm || 30) * nmToM, color: '#00c8a0', fillColor: '#00c8a0',
        fillOpacity: 0.06, weight: 1.2, dashArray: '6 4'
      });
      circle.bindTooltip(t.id + ' · ' + t.name, { className: 'ax-tip' });
      circle.on('click', () => {
        let html = '<div class="meta-grid"><span class="label">ID</span><span class="value">' + t.id + '</span>' +
          '<span class="label">Name</span><span class="value">' + t.name + '</span></div>';
        if (UI.freqTableHtml) html += UI.freqTableHtml(t.id);
        document.getElementById('panel-title').textContent = t.id + ' · ' + t.name;
        document.getElementById('panel-body').innerHTML = html;
        document.getElementById('info-panel').classList.remove('hidden');
      });
      this.layers.tracon.addLayer(circle);
    });
  },

  buildTowerLayer() {
    if (typeof AirspaceData === 'undefined' || !AirspaceData.towers) return;
    this.layers.towers.clearLayers();
    AirspaceData.towers.forEach(tw => {
      const m = L.circleMarker([tw.lat, tw.lon], { radius: 4, color: '#33ff66', weight: 1, fillColor: '#33ff66', fillOpacity: 0.95 });
      m.bindTooltip(tw.id + ' TWR', { className: 'ax-tip' });
      m.on('click', () => {
        let html = '<div class="meta-grid"><span class="label">Facility</span><span class="value">' + tw.id + '</span>' +
          '<span class="label">Name</span><span class="value">' + tw.name + '</span></div>';
        if (UI.freqTableHtml) html += UI.freqTableHtml(tw.id);
        document.getElementById('panel-title').textContent = tw.id + ' · ' + tw.name;
        document.getElementById('panel-body').innerHTML = html;
        document.getElementById('info-panel').classList.remove('hidden');
      });
      this.layers.towers.addLayer(m);
    });
  }
};
