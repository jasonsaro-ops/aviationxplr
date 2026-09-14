/* Runway & Wind panel — pilotgpt-style compass, components, pattern */
const RunwayPanel = {
  /** Parse wind from METAR-like object or raw string → { dir, speed, gust } */
  parseWind(metar) {
    if (!metar) return null;
    // Prefer structured fields from AWC JSON
    if (metar.wdir != null && metar.wspd != null) {
      return { dir: Number(metar.wdir), speed: Number(metar.wspd), gust: metar.wgst != null ? Number(metar.wgst) : null };
    }
    const raw = metar.rawOb || metar.raw_text || (typeof metar === 'string' ? metar : '');
    // 32015KT or 32015G25KT or VRB03KT
    const m = raw.match(/\b(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?KT\b/);
    if (!m) return null;
    if (m[1] === 'VRB') return { dir: null, speed: Number(m[2]), gust: m[4] ? Number(m[4]) : null, vrb: true };
    return { dir: Number(m[1]), speed: Number(m[2]), gust: m[4] ? Number(m[4]) : null };
  },

  /** Head/tail and crosswind for a runway heading (true or mag) */
  components(rwyHdg, windDir, windSpd) {
    if (windDir == null || windSpd == null || rwyHdg == null) {
      return { head: null, cross: null, crossSide: null };
    }
    let diff = ((windDir - rwyHdg + 540) % 360) - 180; // -180..180
    const rad = (diff * Math.PI) / 180;
    const head = Math.round(windSpd * Math.cos(rad)); // + headwind, - tailwind
    const cross = Math.round(windSpd * Math.sin(rad));
    const crossSide = cross > 0 ? 'R' : cross < 0 ? 'L' : '';
    return { head, cross: Math.abs(cross), crossSide, rawCross: cross };
  },

  /** Build list of runway ends from OurAirports runway records */
  endsFromRunways(runways) {
    const ends = [];
    (runways || []).forEach(r => {
      if (r.closed) return;
      const le = r.le_ident || '';
      const he = r.he_ident || '';
      if (le) {
        ends.push({
          ident: le,
          heading: r.le_heading != null ? r.le_heading : this.headingFromIdent(le),
          length: r.length_ft,
          width: r.width_ft,
          surface: r.surface,
          lighted: r.lighted,
          pair: he,
          elev: r.le_elev
        });
      }
      if (he) {
        ends.push({
          ident: he,
          heading: r.he_heading != null ? r.he_heading : this.headingFromIdent(he),
          length: r.length_ft,
          width: r.width_ft,
          surface: r.surface,
          lighted: r.lighted,
          pair: le,
          elev: r.he_elev
        });
      }
    });
    return ends;
  },

  headingFromIdent(id) {
    // "22R" → 220, "04L" → 40, "9" → 90
    const n = parseInt(String(id).replace(/[^0-9]/g, ''), 10);
    if (isNaN(n)) return null;
    return n <= 36 ? n * 10 : n;
  },

  /** SVG compass with runway bars + wind arrow */
  renderCompass(ends, selectedIdent, wind) {
    const size = 220;
    const cx = size / 2, cy = size / 2, r = 95;
    let svg = `<svg viewBox="0 0 ${size} ${size}" width="100%" style="max-width:240px;display:block;margin:0 auto">`;
    // outer ring
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2a3a4a" stroke-width="1.5"/>`;
    // ticks + labels N E S W
    for (let i = 0; i < 36; i++) {
      const a = (i * 10 - 90) * Math.PI / 180;
      const major = i % 9 === 0;
      const x1 = cx + Math.cos(a) * (r - (major ? 12 : 6));
      const y1 = cy + Math.sin(a) * (r - (major ? 12 : 6));
      const x2 = cx + Math.cos(a) * r;
      const y2 = cy + Math.sin(a) * r;
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4a5a6a" stroke-width="${major ? 1.5 : 0.8}"/>`;
    }
    const labels = [{ t: 'N', a: -90 }, { t: 'E', a: 0 }, { t: 'S', a: 90 }, { t: 'W', a: 180 }];
    labels.forEach(({ t, a }) => {
      const rad = a * Math.PI / 180;
      const x = cx + Math.cos(rad) * (r - 22);
      const y = cy + Math.sin(rad) * (r - 22);
      svg += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="#8a9bb0" font-size="11" font-family="system-ui">${t}</text>`;
    });

    // runway bars (pair unique by length+heading to avoid doubles)
    const drawn = new Set();
    ends.forEach(e => {
      if (e.heading == null) return;
      const key = `${Math.round(e.heading / 10) % 18}_${e.length}`;
      if (drawn.has(key)) return;
      drawn.add(key);
      const hdg = e.heading;
      const a = (hdg - 90) * Math.PI / 180;
      const len = 70;
      const x1 = cx + Math.cos(a) * len;
      const y1 = cy + Math.sin(a) * len;
      const x2 = cx - Math.cos(a) * len;
      const y2 = cy - Math.sin(a) * len;
      const isSel = selectedIdent && (e.ident === selectedIdent || e.pair === selectedIdent);
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${isSel ? '#f0a020' : '#6a7a8a'}" stroke-width="${isSel ? 10 : 6}" stroke-linecap="round"/>`;
      // centerline dashes
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1a1a1a" stroke-width="1.5" stroke-dasharray="4 3"/>`;
      // labels at ends
      const lx = cx + Math.cos(a) * (len + 14);
      const ly = cy + Math.sin(a) * (len + 14);
      const lx2 = cx - Math.cos(a) * (len + 14);
      const ly2 = cy - Math.sin(a) * (len + 14);
      svg += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="${isSel ? '#f0a020' : '#c0d0e0'}" font-size="10" font-weight="600" font-family="monospace">${e.ident}</text>`;
      if (e.pair) {
        svg += `<text x="${lx2}" y="${ly2}" text-anchor="middle" dominant-baseline="middle" fill="${isSel ? '#f0a020' : '#c0d0e0'}" font-size="10" font-weight="600" font-family="monospace">${e.pair}</text>`;
      }
    });

    // wind arrow
    if (wind && wind.dir != null) {
      const a = (wind.dir - 90) * Math.PI / 180;
      const tipR = r - 8;
      const tx = cx + Math.cos(a) * tipR;
      const ty = cy + Math.sin(a) * tipR;
      const baseR = r - 28;
      const bx = cx + Math.cos(a) * baseR;
      const by = cy + Math.sin(a) * baseR;
      svg += `<defs><marker id="windArrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#f0a020"/></marker></defs>`;
      svg += `<line x1="${bx}" y1="${by}" x2="${tx}" y2="${ty}" stroke="#f0a020" stroke-width="2.5" marker-end="url(#windArrow)"/>`;
    }

    svg += `</svg>`;
    return svg;
  },

  /** Simple pattern entry diagram */
  renderPattern(end, elevFt) {
    const patternAlt = elevFt != null ? Math.round(elevFt + 1000) : null;
    const left = true; // default left traffic; real data would need Chart Supplement
    return `
      <div class="pattern-box">
        <div class="pattern-title">Pattern entry · RWY ${end.ident}</div>
        <div class="pattern-meta">${end.heading != null ? Math.round(end.heading) + '°' : '—'} · ${left ? 'LEFT' : 'RIGHT'} TRAFFIC
          ${patternAlt != null ? ` · Pattern ~${patternAlt.toLocaleString()} ft MSL` : ''}</div>
        <svg viewBox="0 0 200 160" width="100%" style="max-width:200px;margin:8px auto;display:block">
          <!-- runway -->
          <rect x="85" y="40" width="30" height="80" rx="2" fill="#1a1a1a" stroke="#888"/>
          <text x="100" y="85" text-anchor="middle" fill="#aaa" font-size="9" font-family="monospace">Final</text>
          <!-- pattern rectangle (left traffic) -->
          <path d="M70 120 L40 120 L40 40 L130 40 L130 55" fill="none" stroke="#00d4ff" stroke-width="1.5"/>
          <path d="M130 55 L145 55" fill="none" stroke="#00d4ff" stroke-width="1.5" stroke-dasharray="4 3"/>
          <circle cx="145" cy="55" r="3" fill="#00d4ff"/>
          <text x="155" y="58" fill="#00d4ff" font-size="8">45° entry</text>
          <text x="20" y="85" fill="#8a9bb0" font-size="8">Downwind</text>
          <text x="55" y="35" fill="#8a9bb0" font-size="8">Base</text>
          <text x="100" y="135" fill="#8a9bb0" font-size="8">Crosswind</text>
        </svg>
      </div>`;
  },

  /** Full HTML block for the runway section of the info panel */
  render(runways, metar, elevFt) {
    const ends = this.endsFromRunways(runways);
    if (!ends.length) {
      return `<div class="section-title">RUNWAYS</div><p style="color:var(--text-dim)">No runway data for this ident.</p>`;
    }

    const wind = this.parseWind(metar);
    // pick favored end (max headwind)
    let selected = ends[0];
    if (wind && wind.dir != null) {
      let best = -999;
      ends.forEach(e => {
        if (e.heading == null) return;
        const c = this.components(e.heading, wind.dir, wind.speed);
        if (c.head != null && c.head > best) { best = c.head; selected = e; }
      });
    }

    const comps = wind && selected.heading != null
      ? this.components(selected.heading, wind.dir, wind.speed)
      : { head: null, cross: null, crossSide: '' };

    let html = `<div class="section-title">RUNWAY &amp; WIND</div>`;
    html += `<div class="rwy-wind-panel">`;
    html += this.renderCompass(ends, selected.ident, wind);

    // chip selector
    html += `<div class="rwy-chips">`;
    ends.forEach(e => {
      const active = e.ident === selected.ident ? ' active' : '';
      html += `<button type="button" class="rwy-chip${active}" data-rwy="${e.ident}">${e.ident}</button>`;
    });
    html += `</div>`;

    // wind readout
    if (wind) {
      const dirStr = wind.vrb ? 'VRB' : (wind.dir != null ? wind.dir + '°' : '—');
      html += `<div class="wind-pill">${dirStr} · ${wind.speed} kt${wind.gust ? ' G' + wind.gust : ''}</div>`;
    } else {
      html += `<div class="wind-pill muted">Wind: fetch METAR</div>`;
    }

    // components for selected
    html += `<div class="comp-row">
      <div><span class="comp-label">RWY ${selected.ident}</span><div class="comp-val">${selected.heading != null ? Math.round(selected.heading) + '°M' : '—'}</div></div>
      <div><span class="comp-label">HEAD/TAIL</span><div class="comp-val ${comps.head != null && comps.head < 0 ? 'tail' : 'head'}">${comps.head != null ? (comps.head > 0 ? '+' : '') + comps.head + ' kt' : '—'}</div></div>
      <div><span class="comp-label">CROSSWIND</span><div class="comp-val">${comps.cross != null ? comps.cross + ' kt ' + comps.crossSide : '—'}</div></div>
    </div>`;

    html += this.renderPattern(selected, elevFt);

    // full list
    html += `<div class="section-title" style="margin-top:12px">ALL RUNWAY ENDS</div>`;
    ends.forEach(e => {
      const dims = [e.length ? e.length + ' × ' + (e.width || '?') + ' ft' : '', e.surface || ''].filter(Boolean).join(' · ');
      html += `<div class="rwy-card" data-rwy="${e.ident}">
        <div class="rwy-id">${e.ident}${e.pair ? ' / ' + e.pair : ''}</div>
        <div class="rwy-dims">${e.heading != null ? Math.round(e.heading) + '° · ' : ''}${dims}</div>
      </div>`;
    });

    html += `</div>`;
    return html;
  }
};
