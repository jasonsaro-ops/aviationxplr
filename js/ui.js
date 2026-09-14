/* UI helpers: panels, search, status */
const UI = {
  init() {
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
    document.getElementById('panel-body').innerHTML = html;
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
    document.getElementById('panel-title').textContent = ac.callsign || ac.icao24 || 'Aircraft';
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
    document.getElementById('panel-title').textContent = (airportIdent || '') + ' · RWY ' + label;
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
    if (airportIdent && this.freqTableHtml) html += this.freqTableHtml(airportIdent);
    document.getElementById('panel-body').innerHTML = html;
    document.getElementById('info-panel').classList.remove('hidden');
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
