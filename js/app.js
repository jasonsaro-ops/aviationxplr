/* Main application bootstrap — fast path */
(async function () {
  'use strict';

  UI.updateClock();
  setInterval(() => UI.updateClock(), 1000);

  UI.init();
  MapApp.init();

  UI.setLive(false);
  document.getElementById('last-update').textContent = 'LOADING…';

  try {
    await DataStore.loadAirports();
    MapApp.renderAirports();
    UI.setLastUpdate(new Date());
    UI.setLive(true);
  } catch (e) {
    console.error('Airport load failed', e);
    document.getElementById('last-update').textContent = 'AIRPORT LOAD ERROR';
  }

  DataStore.loadRunways().catch(() => {});
  DataStore.loadFrequencies().catch(() => {});

  async function refreshTraffic() {
    if (!document.getElementById('lyr-traffic')?.checked) return;
    // Prefer viewport center for denser local traffic
    try {
      if (typeof MapApp !== 'undefined' && MapApp.map) {
        const c = MapApp.map.getCenter();
        const z = MapApp.map.getZoom();
        // radius scales with zoom: closer = smaller radius, more detail
        let nm = 80;
        if (z <= 4) nm = 250;
        else if (z <= 6) nm = 150;
        else if (z <= 8) nm = 80;
        else if (z <= 10) nm = 40;
        else nm = 25;
        DataStore._viewportQuery = { lat: c.lat, lon: c.lng, nm };
      }
    } catch (e) {}
    await DataStore.fetchTraffic();
    MapApp.renderTraffic();
    UI.setLastUpdate(DataStore.lastUpdate || new Date());
  }

  async function refreshSlow() {
    const jobs = [];
    if (document.getElementById('lyr-tfrs')?.checked) {
      jobs.push(
        DataStore.fetchWxBrief()
          .then(() => MapApp.renderTFRs())
          .catch(() => DataStore.fetchTFRs().then(() => MapApp.renderTFRs()))
      );
    }
    if (document.getElementById('lyr-pirep')?.checked) {
      jobs.push(DataStore.fetchPireps().then(() => MapApp.renderPireps()));
    }
    if (document.getElementById('lyr-sigmet')?.checked) {
      jobs.push(DataStore.fetchSigmets().then(() => MapApp.renderSigmets()));
    }
    if (jobs.length) await Promise.allSettled(jobs);
  }

  // Fast ADS-B loop
  setTimeout(refreshTraffic, 800);
  setInterval(refreshTraffic, CONFIG.trafficRefreshInterval || 8000);

  // Slow layers
  setTimeout(refreshSlow, 2500);
  setInterval(refreshSlow, CONFIG.refreshInterval || 120000);

  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    refreshTraffic();
    refreshSlow();
    MapApp.renderAirports();
  });

  // Refresh traffic when map moves (debounced)
  let moveTimer;
  MapApp.map.on('moveend', () => {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(refreshTraffic, 600);
  });

  if (!CONFIG.corsWorker) {
    console.info('[AviationXplr] ADS-B via planes.fyi (direct). Optional worker for METAR/TFR: see worker/README.md');
  }
  console.log('%c AviationXplr ready ', 'background:#00d4ff;color:#001018;font-weight:bold;padding:4px 8px');
})();
