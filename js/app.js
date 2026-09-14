/* Main application bootstrap */
(async function () {
  'use strict';

  // Clock
  UI.updateClock();
  setInterval(() => UI.updateClock(), 1000);

  UI.init();
  MapApp.init();

  // Initial data load
  UI.setLive(false);
  document.getElementById('last-update').textContent = 'LOADING…';

  await Promise.all([
    DataStore.loadAirports(),
    DataStore.loadRunways()
  ]);

  MapApp.renderAirports();
  UI.setLastUpdate(new Date());
  UI.setLive(true);

  // Live feeds (best-effort)
  async function refreshLive() {
    const trafficOn = document.getElementById('lyr-traffic').checked;
    const tfrOn = document.getElementById('lyr-tfrs').checked;

    const jobs = [];
    if (trafficOn) jobs.push(DataStore.fetchTraffic().then(() => MapApp.renderTraffic()));
    if (tfrOn) jobs.push(DataStore.fetchTFRs().then(() => MapApp.renderTFRs()));

    if (jobs.length) {
      await Promise.allSettled(jobs);
      UI.setLastUpdate(DataStore.lastUpdate || new Date());
    }
  }

  // First live pull after a short delay so map paints first
  setTimeout(refreshLive, 1500);

  // Auto every 2 minutes
  setInterval(refreshLive, CONFIG.refreshInterval);

  // Manual refresh
  document.getElementById('btn-refresh').addEventListener('click', () => {
    refreshLive();
    MapApp.renderAirports();
  });

  console.log('%c AviationXplr ready ', 'background:#00d4ff;color:#001018;font-weight:bold;padding:4px 8px');
})();
