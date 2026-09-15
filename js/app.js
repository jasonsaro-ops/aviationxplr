/* AviationXplr bootstrap — worldwide */
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
    document.getElementById('last-update').textContent = 'LOAD ERROR';
  }

  DataStore.loadRunways().catch(() => {});
  DataStore.loadFrequencies().catch(() => {});

  // Initial activation for default-checked live layers (TFR etc.)
  setTimeout(async () => {
    if (document.getElementById('lyr-tfrs')?.checked) {
      try {
        await DataStore.fetchTFRs();
        MapApp.renderTFRs();
        if (!MapApp.map.hasLayer(MapApp.layers.tfrs)) MapApp.map.addLayer(MapApp.layers.tfrs);
      } catch (e) { console.warn(e); }
    }
  }, 1500);

  document.getElementById('btn-refresh')?.addEventListener('click', async () => {
    MapApp._allFeatures = null;
    MapApp.renderAirports();
    const jobs = [];
    if (document.getElementById('lyr-tfrs')?.checked) {
      jobs.push(DataStore.fetchTFRs().then(() => MapApp.renderTFRs()));
    }
    if (document.getElementById('lyr-pirep')?.checked) {
      jobs.push(DataStore.fetchPireps().then(() => MapApp.renderPireps()));
    }
    if (document.getElementById('lyr-sigmet')?.checked) {
      jobs.push(DataStore.fetchSigmets().then(() => MapApp.renderSigmets()));
    }
    if (document.getElementById('lyr-metar')?.checked) {
      jobs.push(MapApp.loadMetarStations());
    }
    if (document.getElementById('lyr-radar')?.checked) {
      jobs.push(MapApp.initRadar().then(() => MapApp.startRadarLoop()));
    }
    await Promise.allSettled(jobs);
    UI.setLastUpdate(new Date());
  });

  console.log('%c AviationXplr ready — worldwide ', 'background:#33ff66;color:#001008;font-weight:bold;padding:4px 8px');
})();
