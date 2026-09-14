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

    if (runways.length) {
      html += `<div class="section-title">RUNWAYS (${runways.length})</div>`;
      runways.forEach(r => {
        const id = [r.le_ident, r.he_ident].filter(Boolean).join('/') || '—';
        const dims = [r.length_ft ? r.length_ft + ' × ' + (r.width_ft || '?') + ' ft' : '', r.surface || ''].filter(Boolean).join(' · ');
        const light = r.lighted ? 'LIGHTS' : '';
        const closed = r.closed ? 'CLOSED' : '';
        html += `<div class="rwy-card" data-rwy="${id}">
          <div class="rwy-id">${id} ${closed ? '<span style="color:var(--danger)">' + closed + '</span>' : ''}</div>
          <div class="rwy-dims">${dims} ${light}</div>
          <div class="rwy-dims">HDG ${r.le_heading != null ? Math.round(r.le_heading) + '° / ' + (r.he_heading != null ? Math.round(r.he_heading) + '°' : '—') : '—'}</div>
        </div>`;
      });
    } else {
      html += `<div class="section-title">RUNWAYS</div><p style="color:var(--text-dim)">No runway data loaded for this ident.</p>`;
    }

    html += `<div class="section-title">LIVE WEATHER</div>
      <button class="btn secondary" id="btn-metar" style="width:100%;margin-bottom:8px">FETCH METAR</button>
      <div id="metar-result"></div>`;

    document.getElementById('panel-body').innerHTML = html;
    document.getElementById('info-panel').classList.remove('hidden');

    // METAR button
    const icao = p.icao || p.ident;
    document.getElementById('btn-metar')?.addEventListener('click', async () => {
      const box = document.getElementById('metar-result');
      box.innerHTML = '<span style="color:var(--text-dim)">Loading…</span>';
      const data = await DataStore.fetchMetar([icao]);
      if (data && data.length) {
        const m = data[0];
        const raw = m.rawOb || m.raw_text || JSON.stringify(m, null, 2);
        box.innerHTML = `<div class="metar-box">${raw}</div>`;
      } else {
        box.innerHTML = '<span style="color:var(--warn)">No METAR available or CORS blocked.</span>';
      }
    });
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

  showTFR(tfr) {
    document.getElementById('panel-title').textContent = tfr.notam || tfr.NOTAM || 'TFR';
    const keys = Object.keys(tfr);
    let html = '<div class="meta-grid">';
    keys.forEach(k => {
      const v = tfr[k];
      if (v == null || typeof v === 'object') return;
      html += `<span class="label">${k}</span><span class="value">${String(v)}</span>`;
    });
    html += '</div>';
    if (tfr.links?.details || tfr.detail_url) {
      const url = tfr.links?.details || tfr.detail_url;
      html += `<p style="margin-top:10px"><a href="${url}" target="_blank" rel="noopener" style="color:var(--accent)">View official detail →</a></p>`;
    }
    document.getElementById('panel-body').innerHTML = html;
    document.getElementById('info-panel').classList.remove('hidden');
  },

  hidePanel() {
    document.getElementById('info-panel').classList.add('hidden');
  }
};
