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
  // adsb.lol — primary live traffic (community ADS-B, no key)
  adsblolPoint: 'https://api.adsb.lol/v2/lat/{lat}/lon/{lon}/dist/{nm}',
  // Grid centers to cover CONUS (~250nm each)
  trafficGrid: [
    { lat: 47.5, lon: -122.0 }, { lat: 45.5, lon: -100.0 }, { lat: 42.5, lon: -71.5 },
    { lat: 40.0, lon: -111.0 }, { lat: 39.5, lon: -98.0 }, { lat: 40.5, lon: -80.0 },
    { lat: 34.0, lon: -118.0 }, { lat: 33.0, lon: -97.0 }, { lat: 33.5, lon: -84.0 },
    { lat: 29.0, lon: -95.0 }, { lat: 28.0, lon: -81.5 }, { lat: 36.0, lon: -115.0 }
  ],
  trafficRadiusNm: 280,
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

  // Leidos 1800WXBRIEF Interactive Map public dataLayer
  // METAR category points + TFR polygons with full NOTAM text
  wxbriefDataLayer: 'https://www.1800wxbrief.com/Website/Graphics/api/dataLayer',
  wxbriefLayers: 'metaf,tfr',
  wxbriefBbox: { west: -125, south: 24, east: -66, north: 50 },

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
