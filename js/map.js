/* Leaflet map, layers, markers */
const MapApp = {
  map: null,
  layers: {
    airports: null,      // LayerGroup
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
      preferCanvas: false
    });

    // Basemaps (switchable) — all free, no API key
    const esriDark = L.tileLayer(CONFIG.tiles.dark.url, {
      attribution: CONFIG.tiles.dark.attribution,
      maxZoom: 18,
      maxNativeZoom: 16
    });
    const esriLabels = L.tileLayer(CONFIG.tiles.darkLabels.url, {
      attribution: '',
      maxZoom: 18,
      maxNativeZoom: 16,
      opacity: 0.9
    });
    const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
      maxNativeZoom: 20
    });
    const esriImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19,
      maxNativeZoom: 19
    });
    // Default: Carto dark (sharp at high zoom) — falls back if tiles blocked
    cartoDark.addTo(this.map);
    this._basemaps = {
      'Dark (Carto)': cartoDark,
      'Dark Gray (Esri)': L.layerGroup([esriDark, esriLabels]),
      'Satellite (Esri)': esriImagery
    };
    L.control.layers(this._basemaps, null, { position: 'topright', collapsed: true }).addTo(this.map);

    setTimeout(() => { try { this.map.invalidateSize(); } catch (e) {} }, 200);
    this.map.on('zoomend', () => {
      try { this.map.invalidateSize(false); } catch (e) {}
    });

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
    this.layers.pireps = L.layerGroup();
    this.layers.sigmets = L.layerGroup();

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
    document.getElementById('lyr-pirep')?.addEventListener('change', (e) => {
      if (e.target.checked) { this.map.addLayer(this.layers.pireps); DataStore.fetchPireps().then(() => this.renderPireps()); }
      else this.map.removeLayer(this.layers.pireps);
    });
    document.getElementById('lyr-sigmet')?.addEventListener('change', (e) => {
      if (e.target.checked) { this.map.addLayer(this.layers.sigmets); DataStore.fetchSigmets().then(() => this.renderSigmets()); }
      else this.map.removeLayer(this.layers.sigmets);
    });

    // Filters
    ['flt-large','flt-medium','flt-small','flt-heli','flt-seaplane','flt-scheduled'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => this.applyFilters());
    });

    document.getElementById('btn-fit-americas').addEventListener('click', () => {
      this.map.fitBounds([[-56, -170], [72, -30]]);
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

    const features = DataStore.airports.features;
    const toAdd = [];
    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      const p = f.properties;
      if (!this.typeAllowed(p.type)) continue;
      if (this.filters.scheduled && !p.scheduled) continue;
      toAdd.push(f);
    }

    // Chunk paint so UI stays responsive
    const CHUNK = 2000;
    let idx = 0;
    const self = this;
    function paintChunk() {
      const end = Math.min(idx + CHUNK, toAdd.length);
      for (; idx < end; idx++) {
        const f = toAdd[idx];
        const p = f.properties;
        const [lon, lat] = f.geometry.coordinates;
        const color = CONFIG.airportColors[p.type] || '#8a9bb0';
        const radius = p.type === 'large_airport' ? 4 : (p.type === 'medium_airport' ? 3 : 2);
        const marker = L.circleMarker([lat, lon], {
          radius,
          color: '#0a0e14',
          weight: 0.6,
          fillColor: color,
          fillOpacity: 0.9
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
        airports: idx,
        traffic: DataStore.traffic.length,
        tfrs: (DataStore.wxbriefTfrs || DataStore.tfrs || []).length
      });
      if (idx < toAdd.length) {
        requestAnimationFrame(paintChunk);
      }
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
        color: r.closed ? '#666' : '#00d4ff',
        weight: 5,
        opacity: 0.95,
        lineCap: 'butt'
      });
      const label = (r.le_ident || '?') + '/' + (r.he_ident || '?');
      line.bindTooltip(label + ' · ' + (r.length_ft || '?') + ' ft', { sticky: true, className: 'ax-tip' });
      line.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (typeof UI !== 'undefined' && UI.showRunway) UI.showRunway(r, ident);
      });
      this.layers.runways.addLayer(line);
      // endpoint markers for easier click
      const ends = [coords[0], coords[coords.length - 1]];
      const ids = [r.le_ident, r.he_ident];
      ends.forEach((ll, i) => {
        const mk = L.circleMarker(ll, {
          radius: 5,
          color: '#00d4ff',
          fillColor: '#001018',
          fillOpacity: 1,
          weight: 2
        });
        mk.bindTooltip((ids[i] || '') + '', { className: 'ax-tip' });
        mk.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (typeof UI !== 'undefined' && UI.showRunway) UI.showRunway(r, ident);
        });
        this.layers.runways.addLayer(mk);
      });
    });
  },


  renderTraffic() {
    this.layers.traffic.clearLayers();
    const list = DataStore.traffic || [];
    list.forEach(ac => {
      if (ac.lat == null || ac.lon == null) return;
      const rot = ac.track != null ? ac.track : 0;
      const altFt = ac.alt != null ? ac.alt * 3.28084 : null;
      // altitude color bands
      let color = '#8a9bb0';
      if (altFt == null || ac.onGround) color = '#6a7a8a';
      else if (altFt < 10000) color = '#20e070';
      else if (altFt < 25000) color = '#00d4ff';
      else if (altFt < 35000) color = '#f0c040';
      else color = '#ff6080';

      const icon = L.divIcon({
        className: 'ac-marker',
        html: '<div class="traffic-icon" style="border-bottom-color:' + color + ';transform:rotate(' + rot + 'deg)"></div>',
        iconSize: [12, 14],
        iconAnchor: [6, 7]
      });
      const label = (ac.callsign || ac.icao24 || '').trim();
      const m = L.marker([ac.lat, ac.lon], { icon, title: label, riseOnHover: true, keyboard: false });
      m.bindTooltip(
        label + (altFt != null ? ' · ' + Math.round(altFt) + ' ft' : ''),
        { direction: 'top', offset: [0, -8], className: 'ax-tip', opacity: 0.95 }
      );
      m.on('click', () => UI.showTraffic(ac));
      this.layers.traffic.addLayer(m);
    });
    UI.updateCounts({
      airports: Object.keys(this.airportIndex).length,
      traffic: list.length,
      tfrs: (DataStore.wxbriefTfrs || DataStore.tfrs || []).length
    });
    if (document.getElementById('lyr-traffic')?.checked) {
      this.map.addLayer(this.layers.traffic);
    }
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


  renderPireps() {
    this.layers.pireps.clearLayers();
    (DataStore.pireps || []).forEach(p => {
      const lat = p.lat != null ? p.lat : (p.latitude != null ? p.latitude : null);
      const lon = p.lon != null ? p.lon : (p.longitude != null ? p.longitude : null);
      if (lat == null || lon == null) return;
      const m = L.circleMarker([lat, lon], {
        radius: 4, color: '#ffaa00', fillColor: '#ffaa00', fillOpacity: 0.8, weight: 1
      });
      const txt = p.rawOb || p.raw_text || p.report || JSON.stringify(p).slice(0, 200);
      m.bindTooltip('PIREP', { className: 'ax-tip' });
      m.on('click', () => {
        document.getElementById('panel-title').textContent = 'PIREP';
        document.getElementById('panel-body').innerHTML = '<div class="metar-box">' + String(txt).replace(/</g,'&lt;') + '</div>';
        document.getElementById('info-panel').classList.remove('hidden');
      });
      this.layers.pireps.addLayer(m);
    });
  },

  renderSigmets() {
    this.layers.sigmets.clearLayers();
    (DataStore.sigmets || []).forEach(s => {
      // try geometry
      const geom = s.geometry || s.coords;
      const label = s.hazard || s.airsigmetType || s.rawAirSigmet || 'SIGMET';
      if (geom && geom.coordinates) {
        try {
          const layer = L.geoJSON(geom, {
            style: { color: '#ff6060', fillColor: '#ff6060', fillOpacity: 0.15, weight: 1.5 }
          });
          layer.bindTooltip(String(label).slice(0, 40), { className: 'ax-tip' });
          layer.on('click', () => {
            document.getElementById('panel-title').textContent = 'SIGMET / AIRMET';
            document.getElementById('panel-body').innerHTML = '<div class="metar-box">' + String(s.rawAirSigmet || s.raw || JSON.stringify(s)).replace(/</g,'&lt;') + '</div>';
            document.getElementById('info-panel').classList.remove('hidden');
          });
          this.layers.sigmets.addLayer(layer);
        } catch (e) {}
      }
    });
  },

  buildArtccLayer() {
    if (typeof AirspaceData === 'undefined') return;
    this.layers.artcc.clearLayers();
    const centers = [
      ...(AirspaceData.artcc || []),
      ...(AirspaceData.canadaAcc || []),
      ...(AirspaceData.latamAcc || [])
    ];
    centers.forEach(c => {
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
        let html = '<div class="meta-grid">' +
          '<span class="label">Facility</span><span class="value">' + c.id + '</span>' +
          '<span class="label">Name</span><span class="value">' + c.name + ' Center</span>' +
          '<span class="label">Type</span><span class="value">ARTCC / ACC</span></div>';
        if (typeof UI !== 'undefined' && UI.freqTableHtml) html += UI.freqTableHtml(c.id);
        html += '<p style="color:var(--text-dim);font-size:11px;margin-top:8px">Facility location. Lateral boundaries vary by altitude stratum.</p>';
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
        let html = '<div class="meta-grid">' +
          '<span class="label">ID</span><span class="value">' + t.id + '</span>' +
          '<span class="label">Name</span><span class="value">' + t.name + '</span>' +
          '<span class="label">Type</span><span class="value">TRACON / Approach</span>' +
          '<span class="label">Approx. radius</span><span class="value">' + (t.radiusNm || 30) + ' nm</span></div>';
        if (typeof UI !== 'undefined' && UI.freqTableHtml) html += UI.freqTableHtml(t.id);
        html += '<p style="color:var(--text-dim);font-size:11px;margin-top:8px">Approximate coverage. APP/DEP frequencies shown when published under this facility id.</p>';
        document.getElementById('panel-body').innerHTML = html;
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
        let html = '<div class="meta-grid">' +
          '<span class="label">Facility</span><span class="value">' + tw.id + '</span>' +
          '<span class="label">Name</span><span class="value">' + tw.name + '</span>' +
          '<span class="label">Type</span><span class="value">Control Tower</span>' +
          '<span class="label">Position</span><span class="value">' + tw.lat.toFixed(4) + ', ' + tw.lon.toFixed(4) + '</span>' +
          '</div>';
        if (typeof UI !== 'undefined' && UI.freqTableHtml) html += UI.freqTableHtml(tw.id);
        document.getElementById('panel-body').innerHTML = html;
        document.getElementById('info-panel').classList.remove('hidden');
      });
      this.layers.towers.addLayer(m);
    });
  }
};
