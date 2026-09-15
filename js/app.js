/* AviationXplr bootstrap — worldwide, no ADS-B */
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
    MapApp._allFeatures = null; MapApp.renderAirports();
    UI.setLastUpdate(new Date());
    UI.setLive(true);
  } catch (e) {
    console.error('Airport load failed', e);
    document.getElementById('last-update').textContent = 'LOAD ERROR';
  }

  DataStore.loadRunways().catch(() => {});
  DataStore.loadFrequencies().catch(() => {});

  async function refreshSlow() {
    const jobs = [];
    if (document.getElementById('lyr-tfrs')?.checked) {
      jobs.push(
        DataStore.fetchWxBrief()
          .then(() => MapApp.renderTFRs())
          .catch(() => {})
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

  setTimeout(refreshSlow, 2000);
  setInterval(refreshSlow, CONFIG.refreshInterval || 120000);

  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    refreshSlow();
    MapApp._allFeatures = null; MapApp.renderAirports();
    MapApp.initRadar().then(() => {
      if (document.getElementById('lyr-radar')?.checked) MapApp.startRadarLoop();
    });
  });

  console.log('%c AviationXplr ready — worldwide ', 'background:#00d4ff;color:#001018;font-weight:bold;padding:4px 8px');
})();
