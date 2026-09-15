# AviationXplr CORS Proxy (Cloudflare Worker)

Proxies aviation APIs so the browser can load METAR, TFR, PIREP, SIGMET, etc. from GitHub Pages.

## Deploy with Cloudflare + GitHub (recommended)

1. Push this whole `aviationxplr` repo to GitHub (if not already).
2. In Cloudflare dashboard go to **Workers & Pages** (left sidebar).
   - If you see **Create an app**, prefer **Workers & Pages → Create → Worker**.
3. Choose **Import a repository** / **Continue with GitHub** and authorize the repo.
4. Settings:
   - **Name:** `aviationxplr-proxy`
   - **Root directory:** `/` (repo root — uses root `wrangler.toml`)
   - Or set root to `worker` if the UI asks for the worker folder
5. Deploy. Cloudflare builds from `wrangler.toml` (`main = worker/cors-proxy.js`).
6. Copy the worker URL, e.g. `https://aviationxplr-proxy.YOUR_SUBDOMAIN.workers.dev`
7. In `js/config.js` set:
   ```js
   corsWorker: 'https://aviationxplr-proxy.YOUR_SUBDOMAIN.workers.dev',
   ```
8. Commit, push, hard-refresh the site.

### Quick test

Open in a browser:

```
https://aviationxplr-proxy.YOUR_SUBDOMAIN.workers.dev/
```

You should see `{ "ok": true, ... }`.

Then:

```
https://aviationxplr-proxy.YOUR_SUBDOMAIN.workers.dev/?url=https%3A%2F%2Faviationweather.gov%2Fapi%2Fdata%2Fmetar%3Fids%3DKPHL%26format%3Djson
```

Should return METAR JSON.

## Deploy without Git (paste editor)

1. Workers & Pages → Create → Create Worker  
2. Paste `cors-proxy.js` → Deploy  
3. Set `corsWorker` in `config.js` as above  

## CLI

```bash
cd aviationxplr
npx wrangler login
npx wrangler deploy
```
