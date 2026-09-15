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
    radar: null
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

    // Sidebar toggles (sync with leaflet overlays where possible)
    const bind = (id, layer) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', (e) => {
        if (e.target.checked) this.map.addLayer(layer);
        else this.map.removeLayer(layer);
        if (id === 'lyr-radar' && e.target.checked) this.startRadarLoop();
        if (id === 'lyr-radar' && !e.target.checked) this.stopRadarLoop();
      });
    };
    bind('lyr-airports', this.layers.airports);
    bind('lyr-runways', this.layers.runways);
    bind('lyr-radar', this.layers.radar);
    document.getElementById('lyr-sectional')?.addEventListener('change', (e) => {
      if (e.target.checked) this.map.addLayer(this.layers.sectional);
      else this.map.removeLayer(this.layers.sectional);
    });
    bind('lyr-artcc', this.layers.artcc);
    bind('lyr-tracon', this.layers.tracon);
    bind('lyr-towers', this.layers.towers);
    bind('lyr-tfrs', this.layers.tfrs);
    bind('lyr-pirep', this.layers.pireps);
    bind('lyr-sigmet', this.layers.sigmets);

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

  typeAllowed(type) {
    if (type === 'large_airport') return this.filters.large;
    if (type === 'medium_airport') return this.filters.medium;
    if (type === 'small_airport') return this.filters.small;
    if (type === 'heliport') return this.filters.heli;
    if (type === 'seaplane_base') return this.filters.seaplane;
    return false;
  },

  renderAirports() {
    this.layers.airports.clearLayers();
    this.airportIndex = {};
    if (!DataStore.airports) return;
    const features = DataStore.airports.features;
    const toAdd = [];
    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      const p = f.properties;
      if (!this.typeAllowed(p.type)) continue;
      if (this.filters.scheduled && !p.scheduled) continue;
      toAdd.push(f);
    }
    const CHUNK = 2500;
    let idx = 0;
    const self = this;
    function paintChunk() {
      const end = Math.min(idx + CHUNK, toAdd.length);
      for (; idx < end; idx++) {
        const f = toAdd[idx];
        const p = f.properties;
        const [lon, lat] = f.geometry.coordinates;
        const icon = self.sectionalIcon(p);
        const marker = L.marker([lat, lon], { icon, title: p.name || p.ident, keyboard: false });
        marker.feature = f;
        marker.on('click', () => {
          UI.showAirport(f);
          self.highlightRunways(p.ident);
        });
        self.layers.airports.addLayer(marker);
        self.airportIndex[p.ident] = marker;
      }
      UI.updateCounts({ airports: idx, traffic: 0, tfrs: (DataStore.wxbriefTfrs || DataStore.tfrs || []).length });
      if (idx < toAdd.length) requestAnimationFrame(paintChunk);
    }
    paintChunk();
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
        color: r.closed ? '#666' : '#00d4ff', weight: 5, opacity: 0.95, lineCap: 'butt'
      });
      const label = (r.le_ident || '?') + '/' + (r.he_ident || '?');
      line.bindTooltip(label + ' · ' + (r.length_ft || '?') + ' ft', { sticky: true, className: 'ax-tip' });
      line.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (UI.showRunway) UI.showRunway(r, ident);
      });
      this.layers.runways.addLayer(line);
      [coords[0], coords[coords.length - 1]].forEach((ll, i) => {
        const mk = L.circleMarker(ll, { radius: 5, color: '#00d4ff', fillColor: '#001018', fillOpacity: 1, weight: 2 });
        mk.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (UI.showRunway) UI.showRunway(r, ident);
        });
        this.layers.runways.addLayer(mk);
      });
    });
  },

  showAirportCharts(feature) {
    const p = feature.properties;
    const [lon, lat] = feature.geometry.coordinates;
    // Always bring sectional online for chart context
    try {
      if (this.layers.sectional && !this.map.hasLayer(this.layers.sectional)) {
        this.map.addLayer(this.layers.sectional);
      }
      const secCb = document.getElementById('lyr-sectional');
      if (secCb) secCb.checked = true;
    } catch (e) { console.warn(e); }
    // Stay within sectional native comfort zone, then allow overscale
    this.map.setView([lat, lon], 10, { animate: true });
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
      this._radarFrames = frames.map(f => {
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
        const url = fr.url || (fr.host + fr.path + '/256/{z}/{x}/{y}/2/1_1.png');
        const layer = L.tileLayer(url, {
          opacity: 0.6,
          attribution: 'Radar © RainViewer',
          maxZoom: 12,
          zIndex: 200
        });
        this.layers.radar.addLayer(layer);
      } else {
        // CONUS NEXRAD fallback
        this.layers.radar.addLayer(L.tileLayer(CONFIG.nexradTile, {
          opacity: 0.55,
          attribution: 'NEXRAD · Iowa State',
          maxZoom: 10,
          zIndex: 200
        }));
      }
    };

    if (!this._radarFrames.length) {
      // try load frames then start
      this.initRadar().then(() => {
        this._radarIdx = Math.max(0, this._radarFrames.length - 1);
        paint();
        if (this._radarFrames.length > 1) {
          this._radarTimer = setInterval(() => {
            this._radarIdx = (this._radarIdx + 1) % this._radarFrames.length;
            paint();
          }, 700);
        }
      });
      return;
    }

    this._radarIdx = Math.max(0, this._radarFrames.length - 1);
    paint();
    this._radarTimer = setInterval(() => {
      this._radarIdx = (this._radarIdx + 1) % this._radarFrames.length;
      paint();
    }, 700);
  },

  stopRadarLoop() {
    if (this._radarTimer) clearInterval(this._radarTimer);
    this._radarTimer = null;
    this.layers.radar.clearLayers();
  },

  renderTFRs() {
    this.layers.tfrs.clearLayers();
    const source = (DataStore.wxbriefTfrs && DataStore.wxbriefTfrs.length) ? DataStore.wxbriefTfrs : (DataStore.tfrs || []);
    source.forEach((t) => {
      const geom = t.g || t.geometry;
      if (!geom || !geom.coordinates) return;
      try {
        const color = (t.type === 'tfrp') ? '#ff4060' : '#20c0c0';
        const layer = L.geoJSON(geom, { style: { color, fillColor: color, fillOpacity: 0.2, weight: 2 } });
        layer.on('click', () => UI.showTFR && UI.showTFR(t));
        this.layers.tfrs.addLayer(layer);
      } catch (e) {}
    });
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

  buildArtccLayer() {
    if (typeof AirspaceData === 'undefined') return;
    this.layers.artcc.clearLayers();
    const centers = [...(AirspaceData.artcc || []), ...(AirspaceData.canadaAcc || []), ...(AirspaceData.latamAcc || [])];
    centers.forEach(c => {
      const m = L.circleMarker([c.lat, c.lon], { radius: 5, color: '#9b7bff', weight: 1.5, fillColor: '#7c5cff', fillOpacity: 0.85 });
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
      const m = L.circleMarker([tw.lat, tw.lon], { radius: 3.5, color: '#f0c040', weight: 1, fillColor: '#f0c040', fillOpacity: 0.95 });
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
