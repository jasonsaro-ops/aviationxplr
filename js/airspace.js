/* ARTCC centers + approximate TRACON coverage (public knowledge / simplified) */
const AirspaceData = {
  // Approximate ARTCC facility locations (facility buildings, not full lateral boundaries)
  // Full official ARTCC polygons are in FAA 28-day NASR / ArcGIS; we plot centers + labels
  artcc: [
    { id: 'ZBW', name: 'Boston', lat: 42.36, lon: -71.06 },
    { id: 'ZNY', name: 'New York', lat: 40.78, lon: -73.10 },
    { id: 'ZDC', name: 'Washington', lat: 38.85, lon: -77.03 },
    { id: 'ZTL', name: 'Atlanta', lat: 33.64, lon: -84.43 },
    { id: 'ZJX', name: 'Jacksonville', lat: 30.48, lon: -81.70 },
    { id: 'ZMA', name: 'Miami', lat: 25.79, lon: -80.29 },
    { id: 'ZHU', name: 'Houston', lat: 29.96, lon: -95.34 },
    { id: 'ZME', name: 'Memphis', lat: 35.05, lon: -89.98 },
    { id: 'ZID', name: 'Indianapolis', lat: 39.72, lon: -86.29 },
    { id: 'ZOB', name: 'Cleveland', lat: 41.30, lon: -82.20 },
    { id: 'ZAU', name: 'Chicago', lat: 41.98, lon: -87.90 },
    { id: 'ZMP', name: 'Minneapolis', lat: 44.88, lon: -93.22 },
    { id: 'ZKC', name: 'Kansas City', lat: 38.85, lon: -94.74 },
    { id: 'ZFW', name: 'Fort Worth', lat: 32.83, lon: -97.05 },
    { id: 'ZDV', name: 'Denver', lat: 39.86, lon: -104.67 },
    { id: 'ZAB', name: 'Albuquerque', lat: 35.04, lon: -106.61 },
    { id: 'ZLC', name: 'Salt Lake', lat: 40.79, lon: -111.98 },
    { id: 'ZLA', name: 'Los Angeles', lat: 34.63, lon: -118.08 },
    { id: 'ZOA', name: 'Oakland', lat: 37.73, lon: -122.21 },
    { id: 'ZSE', name: 'Seattle', lat: 47.49, lon: -122.29 },
    { id: 'ZAN', name: 'Anchorage', lat: 61.17, lon: -149.99 },
    { id: 'ZHN', name: 'Honolulu', lat: 21.32, lon: -157.92 }
  ],

  // Major TRACONs — approximate circular coverage (nm radius) for visualization only
  // Official TRACON lateral limits are complex and not freely published as simple GeoJSON for all facilities
  tracon: [
    { id: 'N90', name: 'New York TRACON', lat: 40.70, lon: -73.40, radiusNm: 60 },
    { id: 'PCT', name: 'Potomac TRACON', lat: 38.85, lon: -77.25, radiusNm: 55 },
    { id: 'A90', name: 'Boston TRACON', lat: 42.36, lon: -71.01, radiusNm: 45 },
    { id: 'C90', name: 'Chicago TRACON', lat: 41.98, lon: -87.90, radiusNm: 50 },
    { id: 'SCT', name: 'Southern California TRACON', lat: 33.70, lon: -117.90, radiusNm: 70 },
    { id: 'NCT', name: 'Northern California TRACON', lat: 37.55, lon: -122.00, radiusNm: 55 },
    { id: 'S46', name: 'Seattle TRACON', lat: 47.45, lon: -122.30, radiusNm: 45 },
    { id: 'D10', name: 'Dallas-Fort Worth TRACON', lat: 32.90, lon: -97.04, radiusNm: 50 },
    { id: 'I90', name: 'Houston TRACON', lat: 29.98, lon: -95.34, radiusNm: 50 },
    { id: 'A80', name: 'Atlanta TRACON', lat: 33.64, lon: -84.43, radiusNm: 50 },
    { id: 'MIA', name: 'Miami TRACON', lat: 25.80, lon: -80.30, radiusNm: 50 },
    { id: 'PHL', name: 'Philadelphia TRACON', lat: 39.87, lon: -75.24, radiusNm: 40 },
    { id: 'D21', name: 'Detroit TRACON', lat: 42.21, lon: -83.35, radiusNm: 40 },
    { id: 'T75', name: 'St Louis TRACON', lat: 38.75, lon: -90.37, radiusNm: 40 },
    { id: 'DEN', name: 'Denver TRACON', lat: 39.86, lon: -104.67, radiusNm: 50 },
    { id: 'LAS', name: 'Las Vegas TRACON', lat: 36.08, lon: -115.15, radiusNm: 45 },
    { id: 'P50', name: 'Phoenix TRACON', lat: 33.43, lon: -112.01, radiusNm: 45 },
    { id: 'M98', name: 'Minneapolis TRACON', lat: 44.88, lon: -93.22, radiusNm: 40 },
    { id: 'CLT', name: 'Charlotte TRACON', lat: 35.21, lon: -80.95, radiusNm: 40 },
    { id: 'RDU', name: 'Raleigh-Durham Approach', lat: 35.88, lon: -78.79, radiusNm: 35 }
  ]
};
