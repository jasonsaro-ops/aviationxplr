/* AviationXplr configuration */
const CONFIG = {
  // Map
  defaultCenter: [15, -80], // CONUS center
  defaultZoom: 3,
  minZoom: 3,
  maxZoom: 18,

  // Update cadence (ms)
  refreshInterval: 2 * 60 * 1000, // 2 minutes

  // Data paths (relative for GitHub Pages)
  airportsGeoJSON: 'data/namer_samer_airports.geojson',
  runwaysJSON: 'data/runways_by_ident.json',

  // Public APIs (client-side)
  openskyStates: 'https://opensky-network.org/api/states/all',
  // adsb.lol — primary live traffic (community ADS-B, no key)
  adsblolPoint: 'https://api.adsb.lol/v2/lat/{lat}/lon/{lon}/dist/{nm}',
  // Grid centers to cover CONUS (~250nm each)
  trafficGrid: [
    { lat: 45, lon: -120 }, { lat: 40, lon: -100 }, { lat: 40, lon: -80 },
    { lat: 30, lon: -95 }, { lat: 25, lon: -80 }, { lat: 20, lon: -100 },
    { lat: 10, lon: -85 }, { lat: 0, lon: -60 }, { lat: -15, lon: -50 },
    { lat: -23, lon: -46 }, { lat: -33, lon: -70 }, { lat: -34, lon: -58 },
    { lat: 50, lon: -100 }, { lat: 55, lon: -120 }, { lat: 61, lon: -150 }
  ],
  trafficRadiusNm: 350,
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
  corsProxy: 'https://corsproxy.io/?',
  corsProxyFallback: 'https://api.allorigins.win/raw?url=',

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
