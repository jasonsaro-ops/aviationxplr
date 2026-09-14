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

  // Public APIs (client-side; CORS may apply)
  openskyStates: 'https://opensky-network.org/api/states/all',
  // Bounding box for CONUS roughly to reduce payload
  openskyBbox: { lamin: 24.0, lomin: -125.0, lamax: 50.0, lomax: -66.0 },

  // FAA TFR list (JSON)
  tfrList: 'https://tfr.faa.gov/tfrapi/exportTfrList',

  // Aviation Weather Center
  metarApi: 'https://aviationweather.gov/api/data/metar',
  // Example: ?ids=KJFK,KLAX&format=json

  // Tile layers (dark)
  tiles: {
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
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
