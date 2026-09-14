/* Leaflet map, layers, markers */
const MapApp = {
  map: null,
  layers: {
    airports: null,      // MarkerClusterGroup
    runways: null,       // LayerGroup of polylines
    traffic: null,       // LayerGroup
    tfrs: null,          // LayerGroup (points / simple markers for list)
    metar: null
  },
  airportIndex: {},      // ident -> marker
  filters: {
    large: true, medium: true, small: false, heli: false, seaplane: false, scheduled: false
  },

  init() {
    this.map = L.map('map', {
      center: CONFIG.defaultCenter,
      zoom: CONFIG.defaultZoom,
      minZoom: CONFIG.minZoom,
      maxZoom: CONFIG.maxZoom,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true
    });

    // Base tiles — Esri Dark Gray (no API key) + optional labels
    L.tileLayer(CONFIG.tiles.dark.url, {
      attribution: CONFIG.tiles.dark.attribution,
      maxZoom: CONFIG.tiles.dark.maxZoom
    }).addTo(this.map);

    // Reference / labels overlay (also free, no key)
    if (CONFIG.tiles.darkLabels) {
      L.tileLayer(CONFIG.tiles.darkLabels.url, {
        attribution: CONFIG.tiles.darkLabels.attribution,
        maxZoom: CONFIG.tiles.darkLabels.maxZoom,
        opacity: 0.9
      }).addTo(this.map);
    }

    // Layer groups
    // No clustering — sleek individual markers (canvas for performance)
    this.layers.airports = L.layerGroup();
    this.layers.runways = L.layerGroup();
    this.layers.traffic = L.layerGroup();
    this.layers.tfrs = L.layerGroup();
    this.layers.metar = L.layerGroup();
    this.layers.artcc = L.layerGroup();
    this.layers.tracon = L.layerGroup();
    this.layers.towers = L.layerGroup();

    this.map.addLayer(this.layers.airports);
    this.map.addLayer(this.layers.runways);
    // Add live layers if their checkboxes start checked
    if (document.getElementById('lyr-traffic')?.checked) {
      this.map.addLayer(this.layers.traffic);
    }
    if (document.getElementById('lyr-tfrs')?.checked) {
      this.map.addLayer(this.layers.tfrs);
    }

    this.buildArtccLayer();
    this.buildTraconLayer();
    this.buildTowerLayer();

    // Wire layer toggles
    document.getElementById('lyr-airports').addEventListener('change', (e) => {
      if (e.target.checked) this.map.addLayer(this.layers.airports);
      else this.map.removeLayer(this.layers.airports);
    });
    document.getElementById('lyr-runways').addEventListener('change', (e) => {
      if (e.target.checked) this.map.addLayer(this.layers.runways);
      else this.map.removeLayer(this.layers.runways);
    });
    document.getElementById('lyr-traffic').addEventListener('change', (e) => {
      if (e.target.checked) {
        this.map.addLayer(this.layers.traffic);
        DataStore.fetchTraffic().then(() => this.renderTraffic());
      } else {
        this.map.removeLayer(this.layers.traffic);
      }
    });
    document.getElementById('lyr-tfrs').addEventListener('change', (e) => {
      if (e.target.checked) this.map.addLayer(this.layers.tfrs);
      else this.map.removeLayer(this.layers.tfrs);
    });

    
    document.getElementById('lyr-artcc')?.addEventListener('change', (e) => {
      if (e.target.checked) this.map.addLayer(this.layers.artcc);
      else this.map.removeLayer(this.layers.artcc);
    });
    document.getElementById('lyr-tracon')?.addEventListener('change', (e) => {
      if (e.target.checked) this.map.addLayer(this.layers.tracon);
      else this.map.removeLayer(this.layers.tracon);
    });
    document.getElementById('lyr-towers')?.addEventListener('change', (e) => {
      if (e.target.checked) this.map.addLayer(this.layers.towers);
      else this.map.removeLayer(this.layers.towers);
    });

    // Filters
    ['flt-large','flt-medium','flt-small','flt-heli','flt-seaplane','flt-scheduled'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => this.applyFilters());
    });

    document.getElementById('btn-fit-us').addEventListener('click', () => {
      this.map.fitBounds([[24.5, -125], [49.5, -66.5]]);
    });
  },

  applyFilters() {
    this.filters.large = document.getElementById('flt-large').checked;
    this.filters.medium = document.getElementById('flt-medium').checked;
    this.filters.small = document.getElementById('flt-small').checked;
    this.filters.heli = document.getElementById('flt-heli').checked;
    this.filters.seaplane = document.getElementById('flt-seaplane').checked;
    this.filters.scheduled = document.getElementById('flt-scheduled').checked;
    this.renderAirports();
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

    let count = 0;
    const features = DataStore.airports.features;
    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      const p = f.properties;
      if (!this.typeAllowed(p.type)) continue;
      if (this.filters.scheduled && !p.scheduled) continue;

      const [lon, lat] = f.geometry.coordinates;
      const color = CONFIG.airportColors[p.type] || '#8a9bb0';
      const radius = p.type === 'large_airport' ? 4 : (p.type === 'medium_airport' ? 3 : 2);
      const marker = L.circleMarker([lat, lon], {
        radius,
        color: '#0a0e14',
        weight: 0.8,
        fillColor: color,
        fillOpacity: 0.9,
        title: p.name
      });
      marker.feature = f;
      marker.on('click', () => {
        UI.showAirport(f);
        this.highlightRunways(p.ident);
      });
      this.layers.airports.addLayer(marker);
      this.airportIndex[p.ident] = marker;
      count++;
    }
    UI.updateCounts({
      airports: count,
      traffic: DataStore.traffic.length,
      tfrs: DataStore.tfrs.length
    });
  },

  highlightRunways(ident) {
    this.layers.runways.clearLayers();
    const rwys = DataStore.getRunways(ident);
    rwys.forEach(r => {
      if (r.geometry && r.geometry.coordinates) {
        const coords = r.geometry.coordinates.map(c => [c[1], c[0]]);
        const line = L.polyline(coords, {
          color: '#00d4ff',
          weight: 4,
          opacity: 0.9
        });
        line.bindTooltip(`${r.le_ident || ''}/${r.he_ident || ''} · ${r.length_ft || '?'} ft`, { permanent: false });
        line.on('click', () => {
          // already shown in panel
        });
        this.layers.runways.addLayer(line);
      }
    });
  },

  renderTraffic() {
    this.layers.traffic.clearLayers();
    DataStore.traffic.forEach(ac => {
      const rot = ac.track != null ? ac.track : 0;
      const icon = L.divIcon({
        className: 'ac-marker',
        html: '<div class="traffic-icon" style="transform:rotate(' + rot + 'deg)"></div>',
        iconSize: [10, 12],
        iconAnchor: [5, 6]
      });
      const m = L.marker([ac.lat, ac.lon], { icon, title: ac.callsign || ac.icao24, riseOnHover: true });
      m.on('click', () => UI.showTraffic(ac));
      this.layers.traffic.addLayer(m);
    });
    UI.updateCounts({
      airports: Object.keys(this.airportIndex).length,
      traffic: DataStore.traffic.length,
      tfrs: DataStore.tfrs.length
    });
  },

  renderTFRs() {
    this.layers.tfrs.clearLayers();
    const source = (DataStore.wxbriefTfrs && DataStore.wxbriefTfrs.length)
      ? DataStore.wxbriefTfrs
      : DataStore.tfrs;
    source.forEach((t) => {
      const geom = t.g || t.geometry;
      const notamId = t.notamid || t.notam || t.NOTAM || 'TFR';
      const color = (t.type === 'tfrp') ? '#ff4060' : (t.type === 'tfrf') ? '#4080ff' : '#20c0c0';
      if (geom && geom.coordinates) {
        try {
          const layer = L.geoJSON(geom, {
            style: { color, fillColor: color, fillOpacity: 0.2, weight: 2 }
          });
          layer.bindTooltip(t.notamHoverText ? t.notamHoverText.replace(/<br\/>/g, ' · ') : notamId);
          layer.on('click', () => UI.showTFR({
            notam: notamId,
            description: t.notamHoverText || '',
            msg: t.msg,
            from: t.from,
            to: t.to,
            type: t.type
          }));
          this.layers.tfrs.addLayer(layer);
        } catch (e) { console.warn('TFR geom', e); }
      }
    });
    // METAR category dots from 1800wxbrief
    if (DataStore.wxbriefMetars) {
      DataStore.wxbriefMetars.forEach(m => {
        if (m.lat == null || m.lon == null) return;
        // cat: 4=VFR green, others vary
        const catColors = { 4: '#20e070', 3: '#00d4ff', 2: '#ff4060', 1: '#c040ff', 0: '#888' };
        const col = catColors[m.cat] || '#20e070';
        const mk = L.circleMarker([m.lat, m.lon], {
          radius: 5, color: col, fillColor: col, fillOpacity: 0.85, weight: 1
        });
        mk.bindTooltip(`${m.icao || ''} · cat ${m.cat}`);
        mk.on('click', () => {
          document.getElementById('panel-title').textContent = `${m.icao || 'METAR'} · ${m.stn || ''}`;
          document.getElementById('panel-body').innerHTML = `<div class="metar-box">${m.msg || ''}</div>
            <div class="meta-grid" style="margin-top:10px">
              <span class="label">Category</span><span class="value">${m.cat}</span>
              <span class="label">Obs time</span><span class="value">${m.obTime ? new Date(m.obTime*1000).toISOString() : '—'}</span>
            </div>
            <p style="color:var(--text-dim);font-size:11px;margin-top:8px">Source: 1800WXBRIEF / Leidos Flight Service</p>`;
          document.getElementById('info-panel').classList.remove('hidden');
        });
        this.layers.tfrs.addLayer(mk); // reuse tfrs layer group when TFR toggle on; also add to metar if separate
      });
    }
    if (document.getElementById('lyr-tfrs')?.checked) {
      this.map.addLayer(this.layers.tfrs);
    }
    UI.updateCounts({
      airports: Object.keys(this.airportIndex).length,
      traffic: DataStore.traffic.length,
      tfrs: source.length
    });
  },

  focusAirport(feature) {
    const [lon, lat] = feature.geometry.coordinates;
    this.map.setView([lat, lon], 13, { animate: true });
    UI.showAirport(feature);
    this.highlightRunways(feature.properties.ident);
  },

  buildArtccLayer() {
    if (typeof AirspaceData === 'undefined') return;
    this.layers.artcc.clearLayers();
    AirspaceData.artcc.forEach(c => {
      const m = L.circleMarker([c.lat, c.lon], {
        radius: 5,
        color: '#9b7bff',
        weight: 1.5,
        fillColor: '#7c5cff',
        fillOpacity: 0.85
      });
      m.bindTooltip(c.id + ' · ' + c.name, { className: 'ax-tip' });
      m.on('click', () => {
        document.getElementById('panel-title').textContent = c.id + ' · ' + c.name + ' ARTCC';
        document.getElementById('panel-body').innerHTML = '<div class="meta-grid">' +
          '<span class="label">Facility</span><span class="value">' + c.id + '</span>' +
          '<span class="label">Name</span><span class="value">' + c.name + ' Center</span>' +
          '<span class="label">Type</span><span class="value">ARTCC</span></div>' +
          '<p style="color:var(--text-dim);font-size:11px;margin-top:8px">Facility location. Lateral boundaries vary by altitude stratum (FAA).</p>';
        document.getElementById('info-panel').classList.remove('hidden');
      });
      this.layers.artcc.addLayer(m);
    });
  },

  buildTraconLayer() {
    if (typeof AirspaceData === 'undefined') return;
    this.layers.tracon.clearLayers();
    const nmToM = 1852;
    AirspaceData.tracon.forEach(t => {
      const circle = L.circle([t.lat, t.lon], {
        radius: (t.radiusNm || 30) * nmToM,
        color: '#00c8a0',
        fillColor: '#00c8a0',
        fillOpacity: 0.06,
        weight: 1.2,
        dashArray: '6 4',
        interactive: true
      });
      circle.bindTooltip(t.id + ' · ' + t.name, { sticky: true, className: 'ax-tip' });
      circle.on('click', () => {
        document.getElementById('panel-title').textContent = t.id + ' · ' + t.name;
        document.getElementById('panel-body').innerHTML = '<div class="meta-grid">' +
          '<span class="label">ID</span><span class="value">' + t.id + '</span>' +
          '<span class="label">Name</span><span class="value">' + t.name + '</span>' +
          '<span class="label">Type</span><span class="value">TRACON / Approach</span>' +
          '<span class="label">Approx. radius</span><span class="value">' + (t.radiusNm || 30) + ' nm</span>' +
          '</div><p style="color:var(--text-dim);font-size:11px;margin-top:8px">Approximate coverage for awareness. Official boundaries are complex FAA polygons.</p>';
        document.getElementById('info-panel').classList.remove('hidden');
      });
      this.layers.tracon.addLayer(circle);
      // center tick
      const tick = L.circleMarker([t.lat, t.lon], {
        radius: 3, color: '#00c8a0', fillColor: '#00c8a0', fillOpacity: 1, weight: 1
      });
      tick.bindTooltip(t.id, { permanent: false });
      this.layers.tracon.addLayer(tick);
    });
  },

  buildTowerLayer() {
    if (typeof AirspaceData === 'undefined' || !AirspaceData.towers) return;
    this.layers.towers.clearLayers();
    AirspaceData.towers.forEach(tw => {
      const m = L.circleMarker([tw.lat, tw.lon], {
        radius: 3.5,
        color: '#f0c040',
        weight: 1,
        fillColor: '#f0c040',
        fillOpacity: 0.95
      });
      m.bindTooltip(tw.id + ' TWR', { className: 'ax-tip' });
      m.on('click', () => {
        document.getElementById('panel-title').textContent = tw.id + ' · ' + tw.name;
        document.getElementById('panel-body').innerHTML = '<div class="meta-grid">' +
          '<span class="label">Facility</span><span class="value">' + tw.id + '</span>' +
          '<span class="label">Name</span><span class="value">' + tw.name + '</span>' +
          '<span class="label">Type</span><span class="value">Control Tower</span>' +
          '<span class="label">Position</span><span class="value">' + tw.lat.toFixed(4) + ', ' + tw.lon.toFixed(4) + '</span>' +
          '</div>';
        document.getElementById('info-panel').classList.remove('hidden');
      });
      this.layers.towers.addLayer(m);
    });
  }
};
