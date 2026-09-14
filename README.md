# AviationXplr

**Mission-critical North & South America aviation explorer**

Professional, real-time (as close as public sources allow) map of every airport across North and South America, runways, Temporary Flight Restrictions (TFRs), aviation weather (METAR), and live ADS-B traffic where available.

Styled for operations / briefing use — dark theme, high contrast, clickable metadata panels, layer toggles, 2-minute auto-refresh.

## Live Demo (GitHub Pages)

After pushing to a GitHub repository, enable **Settings → Pages → Deploy from branch (main / root)**.

Then open: `https://<your-username>.github.io/<repo-name>/`

## Features

- **All US airports** (large / medium / small / heliports / seaplane bases) from OurAirports public data
- **Runway centerlines** drawn on click with length, width, surface, lighting, headings
- **Floating metadata panels** — ICAO/IATA, elevation, municipality, links, full runway list, on-demand METAR
- **Layer toggles**: Airports, Runways, Live Traffic (ADS-B), TFRs, METAR (on demand)
- **Airport type filters** + “Scheduled service only”
- **Search** by ICAO, IATA, local ident, name or city
- **Auto-refresh every 2 minutes** for live layers
- **Dark professional UI** suitable for mission briefings

## Data Sources (all public)

| Layer        | Source                          | Notes |
|--------------|----------------------------------|-------|
| Airports     | OurAirports (CSV → GeoJSON)      | Public domain, daily updates |
| Runways      | OurAirports                      | Public domain |
| TFRs         | FAA `tfr.faa.gov/tfrapi/exportTfrList` | Unauthenticated JSON list |
| METAR        | AviationWeather.gov API          | Free, no key |
| Live traffic | OpenSky Network REST API         | Free for non-commercial/research; **CORS often blocked in pure browser** |

### CORS & Live Traffic Limitations

Most pure-browser deployments on GitHub Pages will receive **CORS errors** from OpenSky and sometimes from the FAA TFR endpoint. This is expected.

**Workarounds for production / reliable live data:**

1. Run a tiny CORS proxy (Cloudflare Worker, Vercel Edge, or local Node) that forwards the OpenSky / TFR requests.
2. Feed the OpenSky network yourself → higher rate limits + better coverage.
3. Use a commercial ADS-B provider (FlightAware AeroAPI, ADS-B Exchange paid, etc.) with your own key.

The application degrades gracefully: airports + runways always work offline from the bundled GeoJSON/JSON.

## Project Structure

```
aviationxplr/
├── index.html
├── css/styles.css
├── js/
│   ├── config.js      # endpoints, intervals, tile URLs
│   ├── data.js        # loaders & live fetchers
│   ├── map.js         # Leaflet + layers
│   ├── ui.js          # panels, search, status
│   └── app.js         # bootstrap
├── data/
│   ├── us_airports.geojson   # ~42k airports (NA + SA)
│   └── runways_by_ident.json
└── README.md
```

## Local Development

```bash
# Any static server
npx serve .
# or
python -m http.server 8080
```

Open `http://localhost:8080`.

## Updating Airport / Runway Data

```bash
# Re-download and rebuild (requires Python 3)
curl -sL https://davidmegginson.github.io/ourairports-data/airports.csv -o data/airports_full.csv
curl -sL https://davidmegginson.github.io/ourairports-data/runways.csv -o data/runways_full.csv
# Then re-run the filter scripts that produced us_airports.geojson and runways_by_ident.json
```

(The original generation commands are in the repository history / can be recreated from the Python one-liners used during build.)

## Hosting on GitHub

1. Create a new repository (e.g. `aviationxplr`).
2. Upload the contents of this folder (or push via git).
3. Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`.
4. Wait 1–2 minutes; visit the Pages URL.

No build step required — pure static HTML/CSS/JS + data files.

## Disclaimer

This is an **unofficial visualization** for education, research and situational awareness. It is **not** a certified aeronautical product. Do **not** use as a primary source for flight planning or ATC decisions. Always consult official FAA sources, charts, and NOTAM systems.

OpenSky data is provided under their non-commercial research terms. TFRs and METARs are public government data; interpret with care.

## License

Code: MIT  
Airport/runway data: Public Domain (OurAirports / Unlicense)  
Map tiles: Esri World Dark Gray Canvas + Reference (no API key) · OpenStreetMap / Esri Imagery as attributed


## Live ADS-B / METAR (required one-time setup)

GitHub Pages cannot call aviation APIs from the browser (CORS). Deploy the included free Cloudflare Worker:

1. Open [Cloudflare Workers](https://workers.cloudflare.com) → Create Worker
2. Paste `worker/cors-proxy.js` → Deploy
3. Set in `js/config.js`:
   ```js
   corsWorker: 'https://YOUR_NAME.workers.dev',
   ```
4. Push and hard-refresh

Without this, airports, runways, frequencies, and airspace layers still work; live traffic/METAR/TFRs will not.
