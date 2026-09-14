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
    large: true, medium: true, small: true, heli: false, seaplane: false, scheduled: false
  },

  init() {
    this.map = L.map('map', {
      center: CONFIG.defaultCenter,
      zoom: CONFIG.defaultZoom,
      minZoom: CONFIG.minZoom,
      maxZoom: CONFIG.maxZoom,
      zoomControl: true,
      attributionControl: true
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
    this.layers.airports = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 12
    });
    this.layers.runways = L.layerGroup();
    this.layers.traffic = L.layerGroup();
    this.layers.tfrs = L.layerGroup();
    this.layers.metar = L.layerGroup();
    this.layers.artcc = L.layerGroup();
    this.layers.tracon = L.layerGroup();

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
      const size = p.type === 'large_airport' ? 12 : (p.type === 'medium_airport' ? 10 : 8);
      const icon = L.divIcon({
        className: '',
        html: `<div class="airport-marker ${p.type.replace('_airport','').replace('_base','')}" style="background:${color};width:${size}px;height:${size}px"></div>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2]
      });
      const marker = L.marker([lat, lon], { icon, title: p.name });
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
        className: '',
        html: `<div class="traffic-icon" style="transform: rotate(${rot}deg)"></div>`,
        iconSize: [10, 14],
        iconAnchor: [5, 7]
      });
      const m = L.marker([ac.lat, ac.lon], { icon, title: ac.callsign || ac.icao24 });
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
    AirspaceData.artcc.forEach(c => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#7c5cff;color:#fff;font-size:10px;font-weight:700;padding:2px 5px;border-radius:3px;white-space:nowrap;border:1px solid #a080ff;font-family:monospace">${c.id}</div>`,
        iconSize: [40, 18],
        iconAnchor: [20, 9]
      });
      const m = L.marker([c.lat, c.lon], { icon });
      m.bindTooltip(`${c.id} · ${c.name} ARTCC`, { permanent: false });
      m.on('click', () => {
        UI.hidePanel();
        document.getElementById('panel-title').textContent = `${c.id} · ${c.name} ARTCC`;
        document.getElementById('panel-body').innerHTML = `<div class="meta-grid">
          <span class="label">Facility</span><span class="value">${c.id}</span>
          <span class="label">Name</span><span class="value">${c.name} Center</span>
          <span class="label">Type</span><span class="value">ARTCC (Air Route Traffic Control Center)</span>
          <span class="label">Location</span><span class="value">${c.lat.toFixed(3)}, ${c.lon.toFixed(3)}</span>
        </div>
        <p style="color:var(--text-dim);font-size:11px;margin-top:10px">Facility location marker. Official lateral boundaries are published by FAA (NASR / Enroute charts) and vary by stratum (LOW/HIGH).</p>`;
        document.getElementById('info-panel').classList.remove('hidden');
      });
      this.layers.artcc.addLayer(m);
    });
  },

  buildTraconLayer() {
    if (typeof AirspaceData === 'undefined') return;
    const nmToM = 1852;
    AirspaceData.tracon.forEach(t => {
      const circle = L.circle([t.lat, t.lon], {
        radius: t.radiusNm * nmToM,
        color: '#00c8a0',
        fillColor: '#00c8a0',
        fillOpacity: 0.08,
        weight: 1.5,
        dashArray: '4 4'
      });
      circle.bindTooltip(`${t.id} · ${t.name}`, { sticky: true });
      circle.on('click', () => {
        document.getElementById('panel-title').textContent = `${t.id} · ${t.name}`;
        document.getElementById('panel-body').innerHTML = `<div class="meta-grid">
          <span class="label">ID</span><span class="value">${t.id}</span>
          <span class="label">Name</span><span class="value">${t.name}</span>
          <span class="label">Type</span><span class="value">TRACON / Approach</span>
          <span class="label">Approx. radius</span><span class="value">${t.radiusNm} nm (visualization only)</span>
          <span class="label">Center</span><span class="value">${t.lat.toFixed(3)}, ${t.lon.toFixed(3)}</span>
        </div>
        <p style="color:var(--text-dim);font-size:11px;margin-top:10px">Approximate coverage circle for situational awareness. Official TRACON boundaries are complex polygons published in FAA directives and not freely available as simple public GeoJSON for all facilities.</p>`;
        document.getElementById('info-panel').classList.remove('hidden');
      });
      this.layers.tracon.addLayer(circle);
    });
  }
};
