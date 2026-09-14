/* AviationXplr configuration */
const CONFIG = {
  // Map
  defaultCenter: [39.8, -98.5], // CONUS center
  defaultZoom: 5,
  minZoom: 3,
  maxZoom: 18,

  // Update cadence (ms)
  refreshInterval: 2 * 60 * 1000, // 2 minutes

  // Data paths (relative for GitHub Pages)
  airportsGeoJSON: 'data/us_airports.geojson',
  runwaysJSON: 'data/runways_by_ident.json',

  // Public APIs (client-side)
  openskyStates: 'https://opensky-network.org/api/states/all',
  // Bounding box for CONUS roughly to reduce payload
  openskyBbox: { lamin: 24.0, lomin: -125.0, lamax: 50.0, lomax: -66.0 },

  // FAA TFR list (JSON)
  tfrList: 'https://tfr.faa.gov/tfrapi/exportTfrList',

  // Aviation Weather Center
  metarApi: 'https://aviationweather.gov/api/data/metar',
  // Example: ?ids=KJFK,KLAX&format=json

  // CORS proxy — free public relays so browser can reach OpenSky / FAA / AWC
  // Primary: corsproxy.io  | Fallback: allorigins
  corsProxy: 'https://corsproxy.io/?',
  corsProxyFallback: 'https://api.allorigins.win/raw?url=',

  // Tile layers — NO API KEY REQUIRED
  // Primary dark: Esri World Dark Gray Canvas (free, no key)
  // Labels overlay + OSM / satellite fallbacks
  tiles: {
    dark: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      maxZoom: 16
    },
    darkLabels: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      attribution: '',
      maxZoom: 16
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
