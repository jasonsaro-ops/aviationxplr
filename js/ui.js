/* UI helpers: panels, search, status */
const UI = {
  init() {
    document.getElementById('detail-close')?.addEventListener('click', () => this.hideDetail());
    document.getElementById('panel-close').addEventListener('click', () => this.hidePanel());
    document.getElementById('search').addEventListener('input', (e) => this.onSearch(e.target.value));
    document.getElementById('search').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.clearSearch();
    });
    // Close search on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-wrap')) this.clearSearch();
    });
  },




  showChartPanel(p, feature) {
    const icao = (p.icao || p.ident || '').toUpperCase();
    const [lon, lat] = feature.geometry.coordinates;
    const skyUrl = 'https://skyvector.com/?ll=' + lat.toFixed(5) + ',' + lon.toFixed(5) + '&chart=301&zoom=3';
    const skyApt = icao ? 'https://skyvector.com/airport/' + icao : skyUrl;
    const airnav = icao ? 'https://www.airnav.com/airport/' + icao : '';
    const faa = icao.startsWith('K') && icao.length === 4
      ? 'https://nfdc.faa.gov/nfdcApps/services/ajv5/airportDisplay.jsp?airportId=' + icao.substring(1)
      : '';

    let html = '<div class="chart-panel">';
    html += '<p class="chart-note">SkyVector blocks embedding (X-Frame-Options). Charts open via official links; FAA sectional tiles are drawn on the map.</p>';
    html += '<div class="resource-links">';
    html += '<a class="res-link primary" href="' + skyApt + '" target="_blank" rel="noopener" id="btn-sky-apt">Open SkyVector Airport ↗</a>';
    html += '<a class="res-link primary" href="' + skyUrl + '" target="_blank" rel="noopener" id="btn-sky-ll">SkyVector chart at airport ↗</a>';
    html += '<button type="button" class="res-link primary" id="btn-sky-popup">SkyVector popup window</button>';
    if (airnav) html += '<a class="res-link" href="' + airnav + '" target="_blank" rel="noopener">AirNav ↗</a>';
    if (faa) html += '<a class="res-link" href="' + faa + '" target="_blank" rel="noopener">FAA Airport Data ↗</a>';
    html += '<a class="res-link" href="https://www.notams.faa.gov/dinsQueryWeb/" target="_blank" rel="noopener">FAA NOTAMs ↗</a>';
    html += '</div>';

    // Chart type quick actions on our map
    html += '<div class="freq-title" style="margin-top:12px">MAP CHART LAYERS</div>';
    html += '<div class="resource-links">';
    html += '<button type="button" class="res-link btn-chart" data-chart="sectional">VFR Sectional on map</button>';
    html += '<button type="button" class="res-link btn-chart" data-chart="ifrlow">IFR Low on map</button>';
    html += '<button type="button" class="res-link btn-chart" data-chart="ifrhigh">IFR High on map</button>';
    html += '</div>';

    // Mini preview: static OSM/Esri snapshot link area
    html += '<div class="freq-title" style="margin-top:12px">LOCATION</div>';
    html += '<div class="meta-grid">';
    html += '<span class="label">ICAO</span><span class="value">' + (icao || '—') + '</span>';
    html += '<span class="label">Lat</span><span class="value">' + lat.toFixed(5) + '</span>';
    html += '<span class="label">Lon</span><span class="value">' + lon.toFixed(5) + '</span>';
    html += '</div></div>';

    this.showDetail((icao || p.ident || 'Airport') + ' · Charts', html);

    // Wire chart layer buttons + SkyVector popup
    setTimeout(() => {
      document.querySelectorAll('.btn-chart').forEach(btn => {
        btn.addEventListener('click', () => {
          const kind = btn.getAttribute('data-chart');
          if (typeof MapApp === 'undefined') return;
          // remove other chart overlays first for clarity
          [MapApp.layers.sectional, MapApp.layers.ifrlow, MapApp.layers.ifrhigh].forEach(l => {
            try { if (MapApp.map.hasLayer(l)) MapApp.map.removeLayer(l); } catch (e) {}
          });
          const layer = kind === 'sectional' ? MapApp.layers.sectional
            : kind === 'ifrlow' ? MapApp.layers.ifrlow
            : MapApp.layers.ifrhigh;
          if (layer) MapApp.map.addLayer(layer);
          MapApp.map.setView([lat, lon], kind === 'sectional' ? 10 : 7, { animate: true });
        });
      });
      const pop = document.getElementById('btn-sky-popup');
      if (pop) {
        pop.addEventListener('click', () => {
          const w = Math.min(1200, window.screen.width - 80);
          const h = Math.min(900, window.screen.height - 80);
          window.open(skyApt, 'skyvector', 'noopener,noreferrer,width=' + w + ',height=' + h + ',left=40,top=40');
        });
      }
    }, 50);

    // Zoom to airport only — chart tiles load when user picks a chart layer button
    if (typeof MapApp !== 'undefined' && MapApp.showAirportCharts) {
      MapApp.showAirportCharts(feature);
    }
  },

  showDetail(title, html) {
    const panel = document.getElementById('detail-panel');
    const titleEl = document.getElementById('detail-title');
    const body = document.getElementById('detail-body');
    if (!panel || !body) return;
    if (titleEl) titleEl.textContent = title;
    body.innerHTML = html;
    panel.classList.remove('hidden');
  },

  hideDetail() {
    document.getElementById('detail-panel')?.classList.add('hidden');
  },


  pilotResourcesHtml(p, feature) {
    const icao = (p.icao || p.ident || '').toUpperCase();
    const iata = (p.iata || '').toUpperCase();
    const lat = feature.geometry.coordinates[1];
    const lon = feature.geometry.coordinates[0];
    const links = [];
    if (icao) {
      links.push(['SkyVector', 'https://skyvector.com/airport/' + icao]);
      links.push(['AirNav', 'https://www.airnav.com/airport/' + icao]);
      links.push(['FlightAware', 'https://www.flightaware.com/live/airport/' + icao]);
      links.push(['OurAirports', 'https://ourairports.com/airports/' + icao + '/']);
      // FAA airport diagram / charts (US K-prefix)
      if (icao.startsWith('K') && icao.length === 4) {
        links.push(['FAA Chart Supplement', 'https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/']);
        links.push(['FAA Airport Diagram search', 'https://nfdc.faa.gov/nfdcApps/services/ajv5/airportDisplay.jsp?airportId=' + icao.substring(1)]);
      }
    }
    if (iata) links.push(['Wikipedia search', 'https://en.wikipedia.org/wiki/' + encodeURIComponent(p.name || iata)]);
    links.push(['Google Maps', 'https://www.google.com/maps?q=' + lat + ',' + lon]);
    links.push(['OpenStreetMap', 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lon + '#map=14/' + lat + '/' + lon]);

    let html = '<div class="freq-block"><div class="freq-title">PILOT & PUBLIC RESOURCES</div><div class="resource-links">';
    links.forEach(([label, href]) => {
      html += '<a class="res-link" href="' + href + '" target="_blank" rel="noopener">' + label + ' ↗</a>';
    });
    html += '</div></div>';
    return html;
  },

  freqTableHtml(ident) {
    const list = (typeof DataStore !== 'undefined' && DataStore.getFrequencies)
      ? DataStore.getFrequencies(ident) : [];
    if (!list.length) {
      return '<div class="freq-block"><div class="freq-title">RADIO FREQUENCIES</div><div class="freq-empty">No published frequencies for this facility.</div></div>';
    }
    let rows = list.map(f => {
      const label = (f.desc && f.desc !== f.type) ? (f.type + ' · ' + f.desc) : f.type;
      return '<div class="freq-row"><span class="freq-type">' + (label || '—') + '</span><span class="freq-mhz">' + (f.mhz || '—') + '</span></div>';
    }).join('');
    return '<div class="freq-block"><div class="freq-title">RADIO FREQUENCIES</div><div class="freq-list">' + rows + '</div></div>';
  },

  updateClock() {
    const now = new Date();
    const z = now.toISOString().substr(11, 8) + ' Z';
    document.getElementById('clock').textContent = z;
  },

  setLastUpdate(d) {
    if (!d) return;
    const el = document.getElementById('last-update');
    el.textContent = 'UPDATE: ' + d.toISOString().substr(11, 8) + ' Z';
  },

  setLive(active) {
    const el = document.getElementById('live-indicator');
    el.classList.toggle('live', active);
    el.textContent = active ? '● LIVE' : '○ STANDBY';
  },

  updateCounts({ airports = 0, traffic = 0, tfrs = 0 }) {
    document.getElementById('counts').textContent =
      `Airports: ${airports.toLocaleString()} · Traffic: ${traffic.toLocaleString()} · TFRs: ${tfrs.toLocaleString()}`;
  },

  onSearch(q) {
    const box = document.getElementById('search-results');
    if (!q || q.length < 1) {
      box.classList.add('hidden');
      box.innerHTML = '';
      return;
    }
    const hits = DataStore.searchAirports(q);
    if (!hits.length) {
      box.innerHTML = '<div class="search-item"><span class="name">No matches</span></div>';
      box.classList.remove('hidden');
      return;
    }
    box.innerHTML = hits.map(f => {
      const p = f.properties;
      const code = p.icao || p.ident || p.iata || '—';
      return `<div class="search-item" data-ident="${p.ident}">
        <div><span class="code">${code}</span> <span class="name">${p.name || ''}</span></div>
        <span class="type">${(p.type || '').replace('_',' ')} · ${p.municipality || ''}</span>
      </div>`;
    }).join('');
    box.classList.remove('hidden');
    box.querySelectorAll('.search-item').forEach(el => {
      el.addEventListener('click', () => {
        const ident = el.dataset.ident;
        const feat = hits.find(h => h.properties.ident === ident);
        if (feat) {
          MapApp.focusAirport(feat);
          this.clearSearch();
        }
      });
    });
  },

  clearSearch() {
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('search-results').innerHTML = '';
  },

  showAirport(feature) {
    const p = feature.properties;
    const runways = DataStore.getRunways(p.ident);
    const title = `${p.icao || p.ident || '—'} · ${p.name || 'Unknown'}`;
    document.getElementById('panel-title').textContent = title;

    let html = `<div class="meta-grid">
      <span class="label">Ident</span><span class="value">${p.ident || '—'}</span>
      <span class="label">ICAO / IATA</span><span class="value">${p.icao || '—'} / ${p.iata || '—'}</span>
      <span class="label">Type</span><span class="value">${(p.type || '').replace(/_/g, ' ')}</span>
      <span class="label">Elevation</span><span class="value">${p.elev_ft != null ? p.elev_ft + ' ft' : '—'}</span>
      <span class="label">Municipality</span><span class="value">${p.municipality || '—'}</span>
      <span class="label">Country</span><span class="value">${p.country || '—'}</span>
      <span class="label">Region</span><span class="value">${p.region || '—'}</span>
      <span class="label">Scheduled</span><span class="value">${p.scheduled ? 'Yes' : 'No'}</span>
      <span class="label">Coordinates</span><span class="value">${feature.geometry.coordinates[1].toFixed(5)}, ${feature.geometry.coordinates[0].toFixed(5)}</span>
    </div>`;

    if (p.home_link || p.wiki) {
      html += `<div class="meta-grid">`;
      if (p.home_link) html += `<span class="label">Home</span><span class="value"><a href="${p.home_link}" target="_blank" rel="noopener">Link</a></span>`;
      if (p.wiki) html += `<span class="label">Wikipedia</span><span class="value"><a href="${p.wiki}" target="_blank" rel="noopener">Link</a></span>`;
      html += `</div>`;
    }

    // Runway & wind panel (pilotgpt-style) — initially without METAR
    html += `<div id="rwy-panel-slot">${RunwayPanel.render(runways, null, p.elev_ft)}</div>`;

    html += `<div class="section-title">LIVE WEATHER</div>
      <button class="btn secondary" id="btn-metar" style="width:100%;margin-bottom:8px">FETCH METAR</button>
      <div id="metar-result"></div>`;

    html += this.freqTableHtml(p.ident || p.icao || '');
    html += this.pilotResourcesHtml(p, feature);
    html += '<div class="resource-links" style="margin-top:10px">';
    html += '<button type="button" class="res-link primary" id="btn-open-charts">Charts · SkyVector · Sectional</button>';
    html += '</div>';
    document.getElementById('panel-body').innerHTML = html;
    document.getElementById('btn-open-charts')?.addEventListener('click', () => {
      this.showChartPanel(p, feature);
    });
    document.getElementById('info-panel').classList.remove('hidden');

    // Auto-fetch METAR and upgrade runway panel with wind
    const icao = p.icao || p.ident;
    const upgradeWithMetar = async () => {
      const box = document.getElementById('metar-result');
      if (box) box.innerHTML = '<span style="color:var(--text-dim)">Loading METAR…</span>';
      const data = await DataStore.fetchMetar([icao]);
      if (data && data.length) {
        const m = data[0];
        const raw = m.rawOb || m.raw_text || JSON.stringify(m, null, 2);
        if (box) box.innerHTML = `<div class="metar-box">${raw}</div>`;
        const slot = document.getElementById('rwy-panel-slot');
        if (slot) slot.innerHTML = RunwayPanel.render(runways, m, p.elev_ft);
      } else {
        if (box) box.innerHTML = '<span style="color:var(--warn)">No METAR available or proxy blocked.</span>';
      }
    };
    const bindRwyClicks = () => {
      document.querySelectorAll('.rwy-chip, .rwy-card').forEach(el => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => {
          const id = el.getAttribute('data-rwy');
          if (!id) return;
          const rwy = (runways || []).find(r => r.le_ident === id || r.he_ident === id);
          if (rwy && typeof MapApp !== 'undefined') MapApp.highlightRunways(p.ident);
          if (rwy) UI.showRunway(rwy, p.ident);
        });
      });
    };
    bindRwyClicks();
    document.getElementById('btn-metar')?.addEventListener('click', async () => {
      await upgradeWithMetar();
      bindRwyClicks();
    });
    upgradeWithMetar().then(() => bindRwyClicks());
  },

  showTraffic(ac) {
    const airportOpen = !document.getElementById('info-panel')?.classList.contains('hidden');
    const title = ac.callsign || ac.icao24 || 'Aircraft';
    if (airportOpen) {
      // keep airport panel; show aircraft in detail panel
      const altFt = ac.alt != null ? Math.round(ac.alt * 3.28084) + ' ft' : '—';
      const spdKt = ac.velocity != null ? Math.round(ac.velocity * 1.94384) + ' kt' : '—';
      const html = `<div class="meta-grid">
        <span class="label">ICAO24</span><span class="value">${ac.icao24 || '—'}</span>
        <span class="label">Callsign</span><span class="value">${ac.callsign || '—'}</span>
        <span class="label">Type</span><span class="value">${ac.type || '—'}</span>
        <span class="label">Altitude</span><span class="value">${altFt}</span>
        <span class="label">Groundspeed</span><span class="value">${spdKt}</span>
        <span class="label">Track</span><span class="value">${ac.track != null ? Math.round(ac.track) + '°' : '—'}</span>
        <span class="label">Squawk</span><span class="value">${ac.squawk || '—'}</span>
      </div>`;
      this.showDetail(title, html);
      return;
    }
    document.getElementById('panel-title').textContent = title;
    const altFt = ac.alt != null ? Math.round(ac.alt * 3.28084) + ' ft' : '—';
    const spdKt = ac.velocity != null ? Math.round(ac.velocity * 1.94384) + ' kt' : '—';
    const html = `<div class="meta-grid">
      <span class="label">ICAO24</span><span class="value">${ac.icao24 || '—'}</span>
      <span class="label">Callsign</span><span class="value">${ac.callsign || '—'}</span>
      <span class="label">Country</span><span class="value">${ac.country || '—'}</span>
      <span class="label">Altitude</span><span class="value">${altFt}</span>
      <span class="label">Groundspeed</span><span class="value">${spdKt}</span>
      <span class="label">Track</span><span class="value">${ac.track != null ? Math.round(ac.track) + '°' : '—'}</span>
      <span class="label">Vertical Rate</span><span class="value">${ac.vrate != null ? Math.round(ac.vrate * 196.85) + ' fpm' : '—'}</span>
      <span class="label">On Ground</span><span class="value">${ac.onGround ? 'Yes' : 'No'}</span>
      <span class="label">Squawk</span><span class="value">${ac.squawk || '—'}</span>
      <span class="label">Position</span><span class="value">${ac.lat?.toFixed(5)}, ${ac.lon?.toFixed(5)}</span>
    </div>
    <p style="color:var(--text-dim);font-size:11px;margin-top:10px">Source: OpenSky Network · Non-commercial research use.</p>`;
    document.getElementById('panel-body').innerHTML = html;
    document.getElementById('info-panel').classList.remove('hidden');
  },


  showRunway(r, airportIdent) {
    const label = (r.le_ident || '?') + '/' + (r.he_ident || '?');
    let html = '<div class="meta-grid">' +
      '<span class="label">Runway</span><span class="value">' + label + '</span>' +
      '<span class="label">Length</span><span class="value">' + (r.length_ft != null ? r.length_ft + ' ft' : '—') + '</span>' +
      '<span class="label">Width</span><span class="value">' + (r.width_ft != null ? r.width_ft + ' ft' : '—') + '</span>' +
      '<span class="label">Surface</span><span class="value">' + (r.surface || '—') + '</span>' +
      '<span class="label">Lighted</span><span class="value">' + (r.lighted ? 'Yes' : 'No') + '</span>' +
      '<span class="label">Closed</span><span class="value">' + (r.closed ? 'Yes' : 'No') + '</span>' +
      '<span class="label">LE heading</span><span class="value">' + (r.le_heading != null ? r.le_heading + '°' : '—') + '</span>' +
      '<span class="label">HE heading</span><span class="value">' + (r.he_heading != null ? r.he_heading + '°' : '—') + '</span>' +
      '<span class="label">LE elev</span><span class="value">' + (r.le_elev != null ? r.le_elev + ' ft' : '—') + '</span>' +
      '<span class="label">HE elev</span><span class="value">' + (r.he_elev != null ? r.he_elev + ' ft' : '—') + '</span>' +
      '</div>';
    this.showDetail((airportIdent || '') + ' · RWY ' + label, html);
  },

  showTFR(tfr) {
    document.getElementById('panel-title').textContent = tfr.notam || tfr.NOTAM || 'TFR';
    const from = tfr.from ? new Date(tfr.from * 1000).toISOString() : '—';
    const to = tfr.to ? new Date(tfr.to * 1000).toISOString() : '—';
    let html = `<div class="meta-grid">
      <span class="label">NOTAM</span><span class="value">${tfr.notam || tfr.NOTAM || '—'}</span>
      <span class="label">Type</span><span class="value">${tfr.type || '—'}</span>
      <span class="label">From</span><span class="value">${from}</span>
      <span class="label">To</span><span class="value">${to}</span>
    </div>`;
    if (tfr.description) html += `<p style="margin:8px 0;color:var(--text-dim)">${String(tfr.description).replace(/<br\/?>/gi,' · ')}</p>`;
    if (tfr.msg) html += `<div class="metar-box" style="max-height:280px;overflow:auto">${String(tfr.msg).replace(/</g,'&lt;')}</div>`;
    document.getElementById('panel-body').innerHTML = html;
    document.getElementById('info-panel').classList.remove('hidden');
  },

  hidePanel() {
    document.getElementById('info-panel').classList.add('hidden');
  }
};
