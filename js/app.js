/* Main application bootstrap — fast path */
(async function () {
  'use strict';

  UI.updateClock();
  setInterval(() => UI.updateClock(), 1000);

  UI.init();
  MapApp.init(); // map paints immediately with tiles

  UI.setLive(false);
  document.getElementById('last-update').textContent = 'LOADING…';

  // Phase 1: airports only (critical path)
  try {
    await DataStore.loadAirports();
    MapApp.renderAirports();
    UI.setLastUpdate(new Date());
    UI.setLive(true);
  } catch (e) {
    console.error('Airport load failed', e);
    document.getElementById('last-update').textContent = 'AIRPORT LOAD ERROR';
  }

  // Phase 2: runways in background (not blocking map)
  DataStore.loadRunways().catch(e => console.warn('Runways deferred load failed', e));
  DataStore.loadFrequencies().catch(e => console.warn('Frequencies deferred load failed', e));

  // Live feeds
  async function refreshLive() {
    const jobs = [];
    if (document.getElementById('lyr-traffic')?.checked) {
      jobs.push(DataStore.fetchTraffic().then(() => MapApp.renderTraffic()));
    }
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
    if (jobs.length) {
      await Promise.allSettled(jobs);
      UI.setLastUpdate(DataStore.lastUpdate || new Date());
    }
  }

  // First live pull after map is interactive
  setTimeout(refreshLive, 2000);
  setInterval(refreshLive, CONFIG.refreshInterval);

  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    refreshLive();
    MapApp.renderAirports();
  });

  if (!CONFIG.corsWorker) {
    console.warn('[AviationXplr] Deploy worker/cors-proxy.js and set CONFIG.corsWorker for live ADS-B/METAR. See worker/README.md');
  }

  console.log('%c AviationXplr ready ', 'background:#00d4ff;color:#001018;font-weight:bold;padding:4px 8px');
})();
