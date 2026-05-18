import { vi } from 'vitest';

// Lightweight mock of the `globe.gl` default export used by src/map/globe.js
vi.mock('globe.gl', () => {
  function MockGlobe(container) {
    const state = { polygons: null, width: null, height: null };

    const api = {
      backgroundColor: () => api,
      globeImageUrl: () => api,
      globeOffset: () => api,
      polygonsData: function (d) {
        if (arguments.length === 0) return state.polygons;
        state.polygons = d;
        return api;
      },
      polygonGeoJsonGeometry: () => api,
      polygonAltitude: () => api,
      polygonCapColor: () => api,
      polygonSideColor: () => api,
      polygonStrokeColor: () => api,
      onPolygonHover: () => api,
      onPolygonClick: () => api,
      pointOfView: function (p, t) {
        if (arguments.length === 0) return { lat: 0, lng: 0, altitude: 1 };
        return api;
      },
      camera: () => ({ position: { x: 0, y: 0, z: 2 }, fov: 75 }),
      scene: () => ({
        children: [{ type: 'Mesh', geometry: { boundingSphere: { radius: 1 } }, scale: { x: 1 } }],
      }),
      controls: () => ({
        enablePan: true,
        enableZoom: true,
        update: () => {},
        minDistance: 1.05,
        maxDistance: 10,
      }),
      width: function (w) {
        state.width = w;
        return api;
      },
      height: function (h) {
        state.height = h;
        return api;
      },
      getGlobeRadius: () => 1,
    };

    // attach a synthetic DOM container reference for code that queries it
    api.container = container || { querySelector: () => null };

    return api;
  }

  return { default: MockGlobe };
});
