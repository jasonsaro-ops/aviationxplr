/* AviationXplr configuration */
const CONFIG = {
  // Map
  defaultCenter: [15, -80], // CONUS center
  defaultZoom: 3,
  minZoom: 3,
  maxZoom: 18, // tiles overscale past native

  // Update cadence (ms)
  refreshInterval: 2 * 60 * 1000, // 2 minutes (TFRs etc)
  trafficRefreshInterval: 8 * 1000, // ADS-B poll every 8s
  trafficAnimHz: 20, // animation frames per second

  // Data paths (relative for GitHub Pages)
  airportsGeoJSON: 'data/namer_samer_airports.geojson',
  runwaysJSON: 'data/runways_by_ident.json',
  frequenciesJSON: 'data/frequencies_by_ident.json',

  // Public APIs (client-side)
  openskyStates: 'https://opensky-network.org/api/states/all',
  // adsb.lol — primary live traffic (community ADS-B, no key)
  adsblolPoint: 'https://api.adsb.lol/v2/lat/{lat}/lon/{lon}/dist/{nm}',
  adsbfiPoint: 'https://opendata.adsb.fi/api/v2/lat/{lat}/lon/{lon}/dist/{nm}',
  // planes.fyi — CORS-enabled overhead ADS-B (primary)
  planesFyiOverhead: 'https://api.planes.fyi/api/v1/overhead/?lat={lat}&lng={lon}&radius={nm}',
  planesFyiAirportLive: 'https://api.planes.fyi/api/v1/airports/{icao}/adsb/live/',
  // Grid centers to cover CONUS (~250nm each)
  trafficGrid: [
    { lat: 40.7, lon: -74.0 }, { lat: 42.3, lon: -71.0 }, { lat: 39.0, lon: -77.5 },
    { lat: 33.7, lon: -84.4 }, { lat: 25.8, lon: -80.3 }, { lat: 29.9, lon: -95.3 },
    { lat: 32.9, lon: -97.0 }, { lat: 39.9, lon: -104.9 }, { lat: 33.9, lon: -118.4 },
    { lat: 37.6, lon: -122.3 }, { lat: 47.5, lon: -122.3 }, { lat: 41.9, lon: -87.9 },
    { lat: 45.5, lon: -73.6 }, { lat: 19.4, lon: -99.1 }, { lat: -23.4, lon: -46.5 },
    { lat: -34.6, lon: -58.4 }, { lat: -33.4, lon: -70.6 }, { lat: 51.5, lon: -0.1 }
  ],
  trafficRadiusNm: 100,
  // Bounding box for CONUS roughly to reduce payload
  openskyBbox: { lamin: -56.0, lomin: -170.0, lamax: 72.0, lomax: -30.0 },

  // FAA TFR list (JSON)
  tfrList: 'https://tfr.faa.gov/tfrapi/exportTfrList',

  // Aviation Weather Center
  metarApi: 'https://aviationweather.gov/api/data/metar',
  // AviationWeather.gov bulk products (worldwide coverage for METARs)
  aviationweatherMetar: 'https://aviationweather.gov/api/data/metar',
  aviationweatherTaf: 'https://aviationweather.gov/api/data/taf',
  aviationweatherPirep: 'https://aviationweather.gov/api/data/pirep',
  aviationweatherSigmet: 'https://aviationweather.gov/api/data/airsigmet',
  aviationweatherGairmet: 'https://aviationweather.gov/api/data/gairmet',
  // OpenSky worldwide states
  openskyAll: 'https://opensky-network.org/api/states/all',
  // Example: ?ids=KJFK,KLAX&format=json

  // CORS proxy — free public relays so browser can reach OpenSky / FAA / AWC
  // Primary: corsproxy.io  | Fallback: allorigins
  // Deploy worker/cors-proxy.js to Cloudflare and paste URL here (no trailing slash)
  corsWorker: '',
  corsProxy: 'https://api.codetabs.com/v1/proxy?quest=',
  corsProxyFallback: 'https://api.allorigins.win/raw?url=',
  corsProxyAlt: 'https://corsproxy.io/?',

  // Leidos 1800WXBRIEF Interactive Map public dataLayer
  // METAR category points + TFR polygons with full NOTAM text
  wxbriefDataLayer: 'https://www.1800wxbrief.com/Website/Graphics/api/dataLayer',
  wxbriefLayers: 'metaf,tfr',
  wxbriefBbox: { west: -170, south: -56, east: -30, north: 72 },

  // Tile layers — NO API KEY REQUIRED
  // Primary dark: Esri World Dark Gray Canvas (free, no key)
  // Labels overlay + OSM / satellite fallbacks
  tiles: {
    dark: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      maxZoom: 18,
      maxNativeZoom: 16
    },
    darkLabels: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      attribution: '',
      maxZoom: 18,
      maxNativeZoom: 16
    },
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      subdomains: 'abc',
      maxZoom: 19
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19
    }
  },

  // Marker colors by type
  airportColors: {
    large_airport: '#00d4ff',
    medium_airport: '#20e070',
    small_airport: '#8a9bb0',
    heliport: '#ffb020',
    seaplane_base: '#60a0ff'
  }
};
