/* AviationXplr configuration — worldwide */
const CONFIG = {
  defaultCenter: [20, 0],
  defaultZoom: 2,
  minZoom: 2,
  maxZoom: 18,

  refreshInterval: 2 * 60 * 1000,
  radarRefreshInterval: 5 * 60 * 1000,

  airportsGeoJSON: 'data/world_airports.geojson',
  runwaysJSON: 'data/runways_by_ident.json',
  frequenciesJSON: 'data/frequencies_by_ident.json',

  metarApi: 'https://aviationweather.gov/api/data/metar',
  aviationweatherMetar: 'https://aviationweather.gov/api/data/metar',
  aviationweatherTaf: 'https://aviationweather.gov/api/data/taf',
  tfrList: 'https://tfr.faa.gov/tfrapi/getTfrList',
  tfrShapes: 'https://tfr.faa.gov/tfrapi/getTfrList',
  pirepApi: 'https://aviationweather.gov/api/data/pirep?format=json&age=2.0',
  sigmetApi: 'https://aviationweather.gov/api/data/airsigmet?format=json',
  metarBbox: 'https://aviationweather.gov/api/data/metar?format=json&bbox={west},{south},{east},{north}',

  // RainViewer public weather maps (no key)
  rainviewerMaps: 'https://api.rainviewer.com/public/weather-maps.json',

  // Iowa State NEXRAD (CONUS) — free tiles
  nexradTile: 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png',

  corsWorker: 'https://aviationxplr-proxy.jasonsaro.workers.dev', // e.g. 'https://aviationxplr-proxy.YOUR_SUBDOMAIN.workers.dev',
  corsProxy: 'https://api.allorigins.win/get?url=',

  tiles: {
    dark: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri',
      maxZoom: 18,
      maxNativeZoom: 16
    },
    darkLabels: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      attribution: '',
      maxZoom: 18,
      maxNativeZoom: 16
    },
    imagery: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19
    },
    topo: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19
    },
    streets: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19
    },
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    },
    // FAA sectional (US only) via various free mirrors — ChartBundle style
    sectional: {
      url: 'https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}',
      attribution: 'FAA VFR Sectional',
      maxZoom: 12,
      maxNativeZoom: 12
    }
  },

  // ATC / Pushing Tin phosphor palette
  airportColors: {
    large_airport: '#33ff66',
    medium_airport: '#22cc55',
    small_airport: '#1a993f',
    heliport: '#88ffaa',
    seaplane_base: '#44ddaa'
  }
};
