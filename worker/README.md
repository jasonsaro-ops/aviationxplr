# CORS Proxy Worker (required for live ADS-B / METAR / TFRs)

GitHub Pages cannot call most aviation APIs directly (browser CORS). Deploy this free Cloudflare Worker once:

1. Sign up at https://workers.cloudflare.com (free)
2. **Create Worker** → paste contents of `cors-proxy.js`
3. **Deploy** → copy the URL, e.g. `https://aviationxplr-proxy.YOUR_SUBDOMAIN.workers.dev`
4. Open `js/config.js` and set:
   ```js
   corsWorker: 'https://aviationxplr-proxy.YOUR_SUBDOMAIN.workers.dev',
   ```
5. Commit, push, hard-refresh the site

Without this, airports/runways/frequencies still work; live traffic and METAR will not.
