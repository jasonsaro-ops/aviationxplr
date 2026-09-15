# AviationXplr

**Worldwide aviation situational display** for GitHub Pages — airports, runways, frequencies, FAA chart overlays, weather radar, and pilot resource links.

Mission-critical dark UI. Client-side only (static hosting).

---

## Features

### Airports (worldwide)
- ~72,000 facilities from [OurAirports](https://ourairports.com) (public domain)
- Types: large / medium / small airports, heliports, seaplane bases
- **FAA VFR sectional-inspired symbology** on the map:
  - Large: filled magenta circle with ticks
  - Medium: open or filled circle with ticks
  - Small: open magenta circle
  - Heliport: magenta “H”
  - Seaplane: cyan water symbol
- Filters: type + scheduled service only

### Click an airport
- Full metadata (ident, ICAO/IATA, elevation, country, region, coordinates)
- **Runway & wind panel** (compass, components, pattern entry)
- Runway centerlines drawn on the map (clickable)
- **Radio frequencies** (TWR, GND, ATIS, APP, DEP, CTAF, UNICOM, …)
- **Charts companion panel**:
  - **SkyVector** airport + coordinate links (official site)
  - AirNav, FAA airport data, NOTAMs
  - One-click **VFR Sectional / IFR Low / IFR High** map overlays
- Dual panels: airport info stays open while runway/chart detail shows beside it

### Map basemaps
- Dark Gray (Esri)
- Satellite (Esri)
- Topographic (Esri)
- Streets (Esri)
- OpenStreetMap

### Aeronautical chart overlays (FAA tiles)
- **VFR Sectional**
- **IFR Low**
- **IFR High**  

US chart coverage via ArcGIS/FAA tile services. SkyVector cannot be embedded (`X-Frame-Options: SAMEORIGIN`); official SkyVector links open from the charts panel.

### Weather radar
- **RainViewer** global animated radar loop
- **Iowa State NEXRAD** fallback (CONUS)
- Toggle: *Weather Radar* (sidebar or layer control)

### Airspace / facilities (reference)
- ARTCC / ACC markers (US, Canada, LatAm hubs)
- TRACON approximate coverage
- Control tower markers + frequencies when published

### Not included
- Live ADS-B / flight tracking (removed)
- Embedded SkyVector web app (blocked by SkyVector; links provided)
- Guaranteed METAR without a CORS proxy (AviationWeather.gov blocks browsers)

---

## Quick start (GitHub Pages)

1. Create a repo (e.g. `aviationxplr`)
2. Upload the contents of this project to the repo root (or `/docs`)
3. Settings → Pages → deploy from branch `/` or `/docs`
4. Open `https://YOUR_USER.github.io/aviationxplr/`

Hard-refresh after updates (`Ctrl+Shift+R` / `Cmd+Shift+R`).

---


## Cloudflare Worker (CORS proxy) — GitHub link

Live METAR / TFR / PIREP / SIGMET need a tiny proxy. Deploy from this repo:

1. Push repo to GitHub  
2. Cloudflare dashboard → **Workers & Pages** → **Create** → connect **GitHub**  
3. Select this repository  
4. Use root `wrangler.toml` (builds `worker/cors-proxy.js` as `aviationxplr-proxy`)  
5. After deploy, set in `js/config.js`:
   ```js
   corsWorker: 'https://aviationxplr-proxy.<your-subdomain>.workers.dev',
   ```
6. Commit & push; hard-refresh the site  

Details: [`worker/README.md`](worker/README.md)


## Optional: CORS worker (METAR / some live feeds)

Browser calls to AviationWeather.gov and 1800WXBRIEF fail CORS from GitHub Pages.

1. Deploy `worker/cors-proxy.js` on [Cloudflare Workers](https://workers.cloudflare.com) (free)
2. Set in `js/config.js`:
   ```js
   corsWorker: 'https://YOUR_WORKER.workers.dev',
   ```
3. Redeploy the site

Radar tiles and static airport data work **without** the worker.

---

## Data sources

| Data | Source |
|------|--------|
| Airports, runways, frequencies | OurAirports (public domain) |
| VFR / IFR chart tiles | FAA via ArcGIS tile services |
| Chart links | [SkyVector](https://skyvector.com), AirNav, FAA NFDC |
| Global radar | [RainViewer](https://www.rainviewer.com) public API |
| CONUS NEXRAD | Iowa State University MESONET |
| METAR / TAF | AviationWeather.gov (proxy often required) |
| Basemaps | Esri, OpenStreetMap |

---

## Project layout

```
aviationxplr/
├── index.html
├── css/styles.css
├── js/
│   ├── config.js      # endpoints, tile URLs
│   ├── app.js         # bootstrap
│   ├── map.js         # Leaflet map, layers, sectional symbols
│   ├── data.js        # loaders & live fetches
│   ├── ui.js          # panels, search, charts/SkyVector links
│   ├── runway-panel.js
│   └── airspace.js    # ARTCC / TRACON / towers
├── data/
│   ├── world_airports.geojson
│   ├── runways_by_ident.json
│   └── frequencies_by_ident.json
├── worker/
│   ├── cors-proxy.js
│   └── README.md
└── README.md
```

---

## Controls

- **Layer control** (top-right): basemaps + overlays  
- **Sidebar**: airports, runways, radar, sectional, airspace, filters  
- **Search**: ICAO / IATA / name / city  
- **FIT WORLD**: reset view  
- **FORCE REFRESH**: reload static layers / radar frames  

---

## License / attribution

- OurAirports data: public domain (Unlicense)
- Esri / OSM / FAA / RainViewer: respect their terms and attribution (shown on the map)
- SkyVector® is a trademark of its owners; AviationXplr only links to their public site

Built for situational awareness and education — **not** a substitute for official charts, NOTAMs, or preflight briefing.


## Performance notes

- Airports are drawn **only in the current map view** (viewport culling) and thinned by zoom level to keep memory down.
- **Chart tiles are off by default** — open an airport → **Charts · SkyVector · Sectional** → choose VFR/IFR when needed.
- Prefer **Large + Medium** filters; enabling every small field multiplies marker count.
- Canvas renderer is used for markers. Expect lower RAM than full-world divIcon markers.
