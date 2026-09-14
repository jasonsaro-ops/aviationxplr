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

    // Base tiles
    L.tileLayer(CONFIG.tiles.dark.url, {
      attribution: CONFIG.tiles.dark.attribution,
      subdomains: CONFIG.tiles.dark.subdomains,
      maxZoom: CONFIG.tiles.dark.maxZoom
    }).addTo(this.map);

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

    this.map.addLayer(this.layers.airports);
    this.map.addLayer(this.layers.runways);

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
    // TFR list is usually text-only without geometry in the simple export.
    // We place a marker at a default or skip geometry; users click list-style if we add a list later.
    // For now, if any TFR has lat/lon fields we plot them.
    DataStore.tfrs.forEach((t, idx) => {
      // Try common fields
      let lat = t.lat || t.latitude || t.center_lat;
      let lon = t.lon || t.longitude || t.center_lon;
      if (lat == null || lon == null) return;
      const m = L.circleMarker([lat, lon], {
        radius: 8,
        color: '#ff4060',
        fillColor: '#ff4060',
        fillOpacity: 0.35,
        weight: 2
      });
      m.bindTooltip(t.notam || t.NOTAM || 'TFR');
      m.on('click', () => UI.showTFR(t));
      this.layers.tfrs.addLayer(m);
    });
    // Always show the layer if toggle is on (even if empty)
    if (document.getElementById('lyr-tfrs').checked) {
      this.map.addLayer(this.layers.tfrs);
    }
    UI.updateCounts({
      airports: Object.keys(this.airportIndex).length,
      traffic: DataStore.traffic.length,
      tfrs: DataStore.tfrs.length
    });
  },

  focusAirport(feature) {
    const [lon, lat] = feature.geometry.coordinates;
    this.map.setView([lat, lon], 13, { animate: true });
    UI.showAirport(feature);
    this.highlightRunways(feature.properties.ident);
  }
};
