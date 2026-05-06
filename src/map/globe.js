// Lightweight Globe.gl initializer — deliberately simple and maintainable.
// Responsibility: render a globe into #globeViz using provided GeoJSON.
// Bootstrap loads the GeoJSON and calls `createWorldleGlobe(geojson)`.

import { createHaloManager } from './globe-halo.js';
import { installDebugHelpers } from '../app/debug.js';
import { worldleLiteLogger } from '../app/logger.js';
// Top-level helpers pulled out of the `createWorldleGlobe` closure so they
// can be inspected and tested independently. They accept explicit
// parameters (including logger functions) instead of relying on closure
// variables.
// Configuration constants (extracted for clarity and easy tuning)
const DEFAULT_DESIRED_CAMERA_DISTANCE = 1.3;
const HIDE_ANTARCTICA_DEFAULT = true;
const DEBUG_PANEL_MIN_WIDTH = '220px';
const LARGE_COORD_EXTREME = 1000; // used to flag extreme vertex coordinates
const HALO_CONFIG = {
  color: '#dc2626',
  duration: 1800,
  maxRadius: 150,  // pixels for canvas overlay (not 3D scale)
  easing: 'circleOut'
};
const noop = () => {};

// Fallback colors used when window.gameConstants is not yet available.
// These values mirror gameConstants.COUNTRY_COLORS in src/constants.js.
// If the palette changes there, update here too.
const FALLBACK_COUNTRY_COLORS = {
  light: {
    fill: "#e8eef5",
    stroke: "rgba(71, 85, 105, 0.85)",
    correct: "#58b48a",
    wrong: "#ffd4a3",
    wrongStroke: "#ff8c42",
    target: "#dc2626"
  },
  dark: {
    fill: "#3a557d",
    stroke: "rgba(236, 242, 248, 0.96)",
    correct: "#2f8f6b",
    wrong: "#ffb366",
    wrongStroke: "#ff9500",
    target: "#ef4444"
  }
};

// Top-level: get country colors based on current theme from constants
// Returns the appropriate color set for light or dark theme
const getCountryColorsTop = ({ theme = 'light' } = {}) => {
  const constants = window.gameConstants?.COUNTRY_COLORS ?? FALLBACK_COUNTRY_COLORS;
  return constants[theme] || constants.light;
};

// Analyze GeoJSON features to extract coordinate stats and identify potential issues.

const computeGeoStats = (features) => {
  const stats = {
    features: features.length,
    totalCoords: 0,
    minLon: Infinity,
    maxLon: -Infinity,
    minLat: Infinity,
    maxLat: -Infinity,
    maxAbs: 0,
    perFeature: []
  };

  function scanCoords(obj, featureIdx) {
    if (Array.isArray(obj)) {
      if (obj.length >= 2 && typeof obj[0] === 'number' && typeof obj[1] === 'number') {
        const lon = obj[0];
        const lat = obj[1];
        stats.totalCoords++;
        stats.minLon = Math.min(stats.minLon, lon);
        stats.maxLon = Math.max(stats.maxLon, lon);
        stats.minLat = Math.min(stats.minLat, lat);
        stats.maxLat = Math.max(stats.maxLat, lat);
        stats.maxAbs = Math.max(stats.maxAbs, Math.abs(lon), Math.abs(lat));
        const pf = stats.perFeature[featureIdx] || (stats.perFeature[featureIdx] = { coords: 0, minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity, maxAbs: 0 });
        pf.coords++;
        pf.minLon = Math.min(pf.minLon, lon);
        pf.maxLon = Math.max(pf.maxLon, lon);
        pf.minLat = Math.min(pf.minLat, lat);
        pf.maxLat = Math.max(pf.maxLat, lat);
        pf.maxAbs = Math.max(pf.maxAbs, Math.abs(lon), Math.abs(lat));
      } else {
        for (const item of obj) scanCoords(item, featureIdx);
      }
    } else if (obj && typeof obj === 'object') {
      for (const k of Object.keys(obj)) scanCoords(obj[k], featureIdx);
    }
  }

  features.forEach((f, i) => {
    stats.perFeature[i] = stats.perFeature[i] || { coords: 0, minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity, maxAbs: 0 };
    if (f && f.geometry) scanCoords(f.geometry, i);
  });

  const offenders = stats.perFeature.map((pf, idx) => ({ idx, maxAbs: pf.maxAbs || 0, coords: pf.coords || 0 })).sort((a, b) => b.maxAbs - a.maxAbs).slice(0, 6);
  stats.topOffenders = offenders;
  return stats;
};

const createDebugPanelTop = (globe, { appendTo = document.body } = {}) => {
  try {
    const dbg = document.createElement('div');
    dbg.id = 'globe-debug-panel';
    dbg.setAttribute('aria-hidden', 'true');
    dbg.style.position = 'fixed';
    dbg.style.right = '12px';
    dbg.style.top = '12px';
    dbg.style.background = 'rgba(0,0,0,0.65)';
    dbg.style.color = '#fff';
    dbg.style.padding = '8px 10px';
    dbg.style.fontSize = '12px';
    dbg.style.lineHeight = '1.2';
    dbg.style.borderRadius = '8px';
    dbg.style.zIndex = '9999';
    dbg.style.fontFamily = 'monospace';
    dbg.style.minWidth = DEBUG_PANEL_MIN_WIDTH;
    dbg.style.pointerEvents = 'none';
    const dbgText = document.createElement('pre');
    dbgText.id = 'globe-debug-text';
    dbgText.style.margin = '0';
    dbgText.style.whiteSpace = 'pre-line';
    dbgText.style.fontFamily = 'inherit';
    dbgText.style.fontSize = 'inherit';
    dbgText.textContent = 'globe debug';
    dbg.appendChild(dbgText);
    appendTo.appendChild(dbg);

    let rafId = null;
    const updateDebug = () => {
      try {
        const pov = (typeof globe.pointOfView === 'function') ? globe.pointOfView() : null;
        const cam = (typeof globe.camera === 'function') ? globe.camera() : globe.camera;
        const scene = globe.scene && globe.scene();
        const mesh = scene && scene.children && scene.children.find(c => c.type === 'Mesh');
        let radius = null;
        if (mesh && mesh.geometry) {
          if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
          radius = mesh.geometry.boundingSphere && mesh.geometry.boundingSphere.radius * (mesh.scale?.x || 1);
        }
        const dist = cam && cam.position ? Math.hypot(cam.position.x || 0, cam.position.y || 0, cam.position.z || 0) : null;
        const ratio = (radius && dist) ? (dist / radius) : null;
        const lines = [];
        lines.push('pov: ' + (pov ? `lat=${pov.lat.toFixed(3)},lng=${pov.lng.toFixed(3)},alt=${Number(pov.altitude).toFixed(3)}` : 'n/a'));
        if (cam && cam.position) lines.push('cam.z: ' + Number(cam.position.z).toFixed(2) + ' fov:' + (cam.fov || 'n/a'));
        lines.push('mesh radius: ' + (radius ? Number(radius).toFixed(2) : 'n/a'));
        lines.push('dist/radius: ' + (ratio ? Number(ratio).toFixed(2) : 'n/a'));
        dbgText.textContent = lines.join('\n');
      } catch (e) { /* ignore */ }
      rafId = requestAnimationFrame(updateDebug);
    };

    const start = () => { if (!rafId) rafId = requestAnimationFrame(updateDebug); dbg.style.display = 'block'; };
    const stop = () => { dbg.style.display = 'none'; if (rafId) { cancelAnimationFrame(rafId); rafId = null; } };
    const toggle = () => { if (dbg.style.display === 'none') start(); else stop(); };
    start();
    return { element: dbg, start, stop, toggle };
  } catch (e) { /* non-fatal */ return null; }
};

// Top-level: check if a country feature belongs to a given continent name.
const isCountryInContinentTop = (country, continentName) => {
  if (!continentName) return true;
  const memberships = country?.properties?.continents;
  if (Array.isArray(memberships) && memberships.length > 0) {
    return memberships.includes(continentName);
  }
  return country?.properties?.continent === continentName;
};

// Top-level: normalize a country name or feature to a lowercase trimmed string for comparison.
const normalizeCountryNameTop = (countryOrName) =>
  String(
    countryOrName?.properties?.name ||
    countryOrName?.properties?.displayName ||
    countryOrName || ''
  ).trim().toLowerCase();

// Top-level: find a feature in a polygon data array by normalized country name.
const findFeatureByNameTop = (data, country) => {
  if (!Array.isArray(data)) return null;
  const name = normalizeCountryNameTop(country);
  return data.find(f => normalizeCountryNameTop(f) === name) || null;
};

// Top-level: compute a { lat, lng } centroid from a country feature.
// Returns null when no centroid can be determined.
// NOTE: For MultiPolygon features we intentionally ignore precomputed
// `geometryCenter` / `geometryBounds` properties because they are calculated
// over the full unprocessed geometry, which may include excluded polygon parts
// (e.g. French Guiana for France) and would pull the centroid to the wrong
// location. For simple Polygon features the precomputed values are fine.
const getCountryCentroidTop = (country) => {
  try {
    const isMulti = country?.geometry?.type === 'MultiPolygon';
    const p = country && country.properties;
    if (!isMulti) {
      if (p && Array.isArray(p.geometryCenter) && p.geometryCenter.length >= 2) {
        return { lat: p.geometryCenter[1], lng: p.geometryCenter[0] };
      }
      if (p && Array.isArray(p.geometryBounds) && p.geometryBounds.length >= 4) {
        const [minLon, minLat, maxLon, maxLat] = p.geometryBounds;
        return { lat: (minLat + maxLat) / 2, lng: (minLon + maxLon) / 2 };
      }
    }
    if (country && country.geometry) {
      // For MultiPolygon, pick the largest ring (by coordinate count) so that
      // a small overseas territory listed first (e.g. French Guiana in France's
      // data) doesn't pull the centroid to the wrong location.
      let ring = null;
      if (country.geometry.type === 'MultiPolygon') {
        let best = null, bestLen = -1;
        for (const poly of country.geometry.coordinates) {
          const r = poly[0];
          if (Array.isArray(r) && r.length > bestLen) { best = r; bestLen = r.length; }
        }
        ring = best;
      } else if (country.geometry.type === 'Polygon') {
        ring = country.geometry.coordinates[0];
      }
      const parts = ring;
      if (Array.isArray(parts) && parts.length) {
        let sumLon = 0, sumLat = 0, count = 0;
        for (const pt of parts) {
          if (Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1])) {
            sumLon += pt[0]; sumLat += pt[1]; count += 1;
          }
        }
        if (count > 0) return { lat: sumLat / count, lng: sumLon / count };
      }
    }
  } catch (e) { /* ignore */ }
  return null;
};

// Top-level: apply a state patch to a matching feature and refresh globe polygons.
// Shared by markTarget, markSolved, markWrong to eliminate repeated find-mutate-refresh boilerplate.
const applyPolygonStateTop = (globe, country, patch, { warn = () => {} } = {}) => {
  try {
    const data = (typeof globe.polygonsData === 'function') ? globe.polygonsData() : null;
    if (!Array.isArray(data)) return;
    const name = normalizeCountryNameTop(country);
    for (const f of data) {
      try {
        if (normalizeCountryNameTop(f) === name && f && f.properties) {
          Object.assign(f.properties, patch);
        }
      } catch (e) { /* ignore per-feature errors */ }
    }
    try { globe.polygonsData(data); } catch (e) { /* ignore */ }
  } catch (e) { warn('applyPolygonStateTop failed', e); }
};

// Top-level: create a minimal runtime stub expected by the app.
// Extracted from `createWorldleGlobe` so it can be tested and kept small.
const createRuntimeStubTop = (features = [], globe, { log = () => {}, info = () => {}, warn = () => {} } = {}) => {
  try {
    let allFeatures = Array.isArray(features) ? features : [];
    let activeContinentFilter = null;

    const stub = {
      resetRoundState: () => {
        try {
          const data = (typeof globe.polygonsData === 'function') ? globe.polygonsData() : null;
          if (Array.isArray(data)) {
            for (const f of data) {
              try {
                if (f && f.properties) {
                  f.properties._target = false;
                  f.properties._solved = false;
                  f.properties._wrong = false;
                }
              } catch (e) { /* ignore per-feature errors */ }
            }
            try { globe.polygonsData(data); } catch (e) { /* ignore */ }
          }
        } catch (e) { /* ignore */ }
      },
      markTarget: (country) => {
        try {
          log('[globe] markTarget', country?.properties?.name ?? country);
          const data = (typeof globe.polygonsData === 'function') ? globe.polygonsData() : null;
          if (Array.isArray(data)) {
            for (const f of data) {
              try { if (f && f.properties) f.properties._target = false; } catch (e) { /* ignore */ }
            }
            const target = findFeatureByNameTop(data, country);
            if (target) {
              try { target.properties._target = true; } catch (e) { /* ignore */ }
              try { globe.polygonsData(data); } catch (e) { /* ignore */ }
            }
          }
          // Use the rendered feature (exclusion-applied geometry) for centroid so
          // that stripped parts (e.g. French Guiana) don't pull the camera off.
          const centroidFeature = findFeatureByNameTop(
            (typeof globe.polygonsData === 'function') ? globe.polygonsData() : null,
            country
          ) || country;
          const centroid = getCountryCentroidTop(centroidFeature);
          if (centroid) {
            try { globe.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: 1.8 }, 600); } catch (e) { /* ignore */ }
          }
        } catch (e) { warn('stub.markTarget failed', e); }
      },
      zoomToCountry: (country) => {
        try {
          const centroid = getCountryCentroidTop(country);
          if (centroid) globe.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: 1.8 }, 600);
        } catch (e) { /* ignore */ }
      },
      showLocationHalo: () => {},  // will be wired by createWorldleGlobe
      setRegionFilter: (regionName) => {
        try {
          activeContinentFilter = regionName ? String(regionName).trim() : null;
          const filteredFeatures = activeContinentFilter
            ? allFeatures.filter(f => isCountryInContinentTop(f, activeContinentFilter))
            : allFeatures;
          globe.polygonsData(filteredFeatures);
          info('setRegionFilter applied', { region: activeContinentFilter, renderCount: filteredFeatures.length, totalCount: allFeatures.length });
        } catch (e) { warn('setRegionFilter failed', e); }
      },
      markSolved: (country) => {
        applyPolygonStateTop(globe, country, { _target: false, _solved: true, _wrong: false }, { warn });
      },
      markWrong: (country) => {
        applyPolygonStateTop(globe, country, { _target: false, _wrong: true, _solved: false }, { warn });
      },
      loadCountries: () => Promise.resolve({
        countriesData: features,
        countryNames: features.map(f => f.properties?.name).filter(Boolean).sort(),
        countryByName: new Map(features.map(f => [String(f.properties?.name || '').toLowerCase(), f]))
      }),
      globe: null  // will be set after globe instance is created
    };

    const toggleAntarcticaDisplay = (show) => {
      try {
        const shouldShow = (typeof show === 'boolean') ? show : true;
        const newList = shouldShow
          ? features.filter(f => !(f?.properties?.EXCLUDED))
          : features.filter(f => {
              const name = f?.properties?.name || f?.properties?.NAME || f?.properties?.ADMIN;
              return String(name).toLowerCase() !== 'antarctica' && !(f?.properties?.EXCLUDED);
            });
        globe.polygonsData(newList);
        info('toggleAntarcticaDisplay', { show: shouldShow, renderCount: newList.length });
      } catch (e) { warn('toggleAntarcticaDisplay failed', e); }
    };

    return { stub, toggleAntarcticaDisplay };
  } catch (e) { warn('createRuntimeStubTop failed', e); return { stub: null, toggleAntarcticaDisplay: () => {} }; }
};

// Top-level: create a Globe instance with standard polygon accessors.
const createGlobeInstanceTop = (container, globeImg, renderFeatures, initialFlip, polygonsDataProvider) => {
  const polygonsData = polygonsDataProvider(initialFlip);

  const fallbackTheme = document.documentElement?.dataset?.theme || 'light';
  const fallbackCountryColors = getCountryColorsTop({ theme: fallbackTheme });

  const globe = new Globe(container)
    .globeImageUrl(globeImg)
    .globeOffset([0, 0])
    .polygonsData(polygonsData)
    .polygonGeoJsonGeometry('geometry')
    .polygonAltitude(() => 0.02)
    .polygonCapColor((d) => {
      try {
        // Dynamically get current theme colors on each render
        const currentTheme = document.documentElement?.dataset?.theme || 'light';
        const colors = getCountryColorsTop({ theme: currentTheme });
        if (d && d.properties) {
          if (d.properties._solved) return colors.correct;
          if (d.properties._wrong) return colors.wrong;
          if (d.properties._target) return colors.target;
        }
        return colors.fill;
      } catch (e) { /* ignore */ }
      return fallbackCountryColors.fill;
    })
    .polygonSideColor(() => 'rgba(0,0,0,0)')
    .polygonStrokeColor((d) => {
      try {
        // Dynamically get current theme colors on each render
        const currentTheme = document.documentElement?.dataset?.theme || 'light';
        const colors = getCountryColorsTop({ theme: currentTheme });
        if (d && d.properties && d.properties._wrong) return colors.wrongStroke;
        return colors.stroke;
      } catch (e) { /* ignore */ }
      return fallbackCountryColors.stroke;
    })
    .onPolygonHover((d) => { container.style.cursor = d ? 'pointer' : 'auto'; });
  return globe;
};

// Top-level: perform post-construction checks (canvas/WebGL + camera sanity)
const postConstructionChecksTop = (globe, container, initialView, { log = () => {}, warn = () => {}, error = () => {} } = {}) => {
  requestAnimationFrame(() => {
    try {
      const canvas = container.querySelector('canvas');
      log('globe canvas present?', Boolean(canvas));
      if (canvas) {
        const gl = canvas.getContext && (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        log('webgl present?', Boolean(gl));
        if (gl) {
          try {
            const vendor = gl.getParameter(gl.VENDOR);
            const renderer = gl.getParameter(gl.RENDERER);
            const version = gl.getParameter(gl.VERSION);
            log('GL info', { vendor, renderer, version });
          } catch (e) { /* ignore reading params on some contexts */ }
        }
      }

      try {
        const cam = (typeof globe.camera === 'function') ? globe.camera() : globe.camera;
        if (cam && cam.position) {
          const { x, y, z } = cam.position;
          if (![x, y, z].every(Number.isFinite)) {
            warn('camera position invalid — applying safe default');
            try {
              globe.pointOfView(initialView, 0);
              const controls = globe.controls && globe.controls();
              if (controls && typeof controls.update === 'function') controls.update();
            } catch (e) { /* ignore */ }
          }
        }
      } catch (e) { /* ignore camera fixes */ }
    } catch (e) { error('post-construction checks failed', e); }
  });
};

// Top-level: configure orbit controls for consistent behavior
const configureControlsTop = (globe, { info = () => {} } = {}) => {
  try {
    const controls = globe.controls();
    if (!controls) return;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.rotateSpeed = 0.6;
    const globeRadiusAbs = (typeof globe.getGlobeRadius === 'function') ? globe.getGlobeRadius() : 1;
    // Set minDistance to prevent zooming through polygons (which render at altitude 0.02)
    controls.minDistance = Math.max(1.05, globeRadiusAbs * 1.05);
    controls.maxDistance = Math.max(3, globeRadiusAbs * 10);
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI - 0.2;
    if (typeof controls.target?.set === 'function') controls.target.set(0, 0, 0);
    if (typeof controls.update === 'function') controls.update();
    info('configureControlsTop applied', { minDistance: controls.minDistance, maxDistance: controls.maxDistance });
  } catch (e) { /* non-fatal */ }
};

export function createWorldleGlobe(geojson) {
  if (typeof Globe === 'undefined') {
    worldleLiteLogger.warn('Globe.gl not available; skipping globe initialization');
    return null;
  }

  const container = document.getElementById('globeViz');
  if (!container) return null;

  const features = Array.isArray(geojson?.features) ? geojson.features : [];
  // Silence all internal logging in production builds — replace with no-ops.
  // If you need logs again, temporarily re-enable or route through
  // `window.worldleLiteLogger` before calling `createWorldleGlobe`.
  const log = noop;
  const info = noop;
  const warn = noop;
  const error = noop;

  try {
    const geoStats = computeGeoStats(features);
    info('geoStats', { features: geoStats.features, totalCoords: geoStats.totalCoords, minLon: geoStats.minLon, maxLon: geoStats.maxLon, minLat: geoStats.minLat, maxLat: geoStats.maxLat, maxAbs: geoStats.maxAbs, topOffenders: geoStats.topOffenders });
    // expose for debugging in console
    window.worldleLiteGeoStats = geoStats;
  } catch (e) {
    warn('computeGeoStats failed', e);
  }
  info('createWorldleGlobe: initializing', { countries: features.length });

  const themePref = document.documentElement?.dataset?.theme || 'light';
  const globeImg = themePref === 'dark' ? 'img/earth-dark.jpg' : 'img/earth-light.jpg';

  // Temporarily filter out Antarctica for rendering to avoid oversized mesh issues.
  // This does not remove the feature from the app state; it's only for the globe layer.
  const SHOULD_HIDE_ANTARCTICA = HIDE_ANTARCTICA_DEFAULT;
  // Strip explicitly excluded polygon parts (e.g. French Guiana from France)
  // using the bounding-box exceptions configured in gameConfig.
  const excludedBounds = window.gameConfig?.COUNTRY_EXCLUDED_POLYGON_BOUNDS;
  const _applyGlobeExclusions = (feature) => {
    if (!excludedBounds || excludedBounds.size === 0) return feature;
    const key = String(feature?.properties?.name || feature?.properties?.NAME_EN || '').trim().toLowerCase();
    const boxes = excludedBounds.get(key);
    if (!boxes || !boxes.length) return feature;
    if (feature.geometry?.type !== 'MultiPolygon') return feature;
    const parts = feature.geometry.coordinates;
    if (parts.length <= 1) return feature;
    const kept = parts.filter((poly) => {
      const ring = poly[0];
      if (!Array.isArray(ring) || !ring.length) return true;
      let sumLon = 0, sumLat = 0;
      for (const pt of ring) { sumLon += pt[0]; sumLat += pt[1]; }
      const cLon = sumLon / ring.length;
      const cLat = sumLat / ring.length;
      return !boxes.some(([minLon, minLat, maxLon, maxLat]) =>
        cLon >= minLon && cLon <= maxLon && cLat >= minLat && cLat <= maxLat
      );
    });
    if (kept.length === parts.length) return feature;
    const finalParts = kept.length > 0 ? kept : [parts[0]];
    return { ...feature, geometry: { type: finalParts.length === 1 ? 'Polygon' : 'MultiPolygon', coordinates: finalParts.length === 1 ? finalParts[0] : finalParts } };
  };

  const renderFeatures = Array.isArray(features)
    ? features.filter(f => {
      try {
        const name = f?.properties?.name || f?.properties?.NAME || f?.properties?.ADMIN;
        const excluded = f?.properties?.EXCLUDED;
        if (SHOULD_HIDE_ANTARCTICA && String(name).toLowerCase() === 'antarctica') return false;
        if (excluded) return false;
        return true;
      } catch (e) { return true; }
    }).map(_applyGlobeExclusions)
    : [];

  info('globe: rendering features', { total: features.length, renderCount: renderFeatures.length, hiddenAntarctica: features.length - renderFeatures.length });

  // Helper: produce the features passed to Globe.gl, optionally flipping
  // longitudes when `flipped` is truthy.
  const buildProcessedFeatures = (flipped) => {
    if (!flipped) return renderFeatures;
    const cloneAndFlip = (obj) => {
      if (Array.isArray(obj)) {
        if (obj.length >= 2 && typeof obj[0] === 'number' && typeof obj[1] === 'number') {
          const rest = obj.slice(2);
          return [ -Number(obj[0]), Number(obj[1]), ...rest ];
        }
        return obj.map(cloneAndFlip);
      } else if (obj && typeof obj === 'object') {
        const out = {};
        for (const k of Object.keys(obj)) {
          out[k] = cloneAndFlip(obj[k]);
        }
        return out;
      }
      return obj;
    };
    try {
      return renderFeatures.map(f => {
        try {
          if (!f || !f.geometry) return f;
          const nf = Object.assign({}, f);
          nf.geometry = cloneAndFlip(f.geometry);
          return nf;
        } catch (e) { return f; }
      });
    } catch (e) { return renderFeatures; }
  };

  const initialFlip = Boolean(window.worldleFlipLon);
  const globe = createGlobeInstanceTop(container, globeImg, renderFeatures, initialFlip, buildProcessedFeatures);

  // Startup diagnostics: record which Globe.gl script was loaded and any
  // available `Globe.version`. This helps quickly determine whether a
  // vendored or CDN build is in use when oversized meshes appear.
  try {
    const globeScript = Array.from(document.querySelectorAll('script')).find(s => (s.src || '').includes('globe.gl'));
    const globeVersion = (typeof Globe !== 'undefined' && Globe.version) ? Globe.version : (typeof Globe !== 'undefined' ? 'defined-no-version' : 'undefined');
    info('globe:init', { scriptSrc: globeScript ? globeScript.src : null, version: globeVersion });
    // expose for quick inspection in console
    window.globeLibInfo = { scriptSrc: globeScript ? globeScript.src : null, version: globeVersion };
  } catch (e) { warn('globe:init diagnostics failed', e); }

  // Note: mesh normalization was intentionally removed to keep all
  // coordinate scaling deterministic at build time. Ensure the input
  // GeoJSON is valid (lon/lat) so the globe renders at correct scale.

  // Minimal initial view (conservative zoomed-out start). Use globe radii.
  const initialView = { lat: 0, lng: 0, altitude: DEFAULT_DESIRED_CAMERA_DISTANCE };
  // Ensure the internal canvas matches the container size so the globe
  // appears centered and occupies the expected layout area.
  try {
    const cw = container.clientWidth || container.offsetWidth || null;
    const ch = container.clientHeight || container.offsetHeight || null;
    if (cw && ch && typeof globe.width === 'function' && typeof globe.height === 'function') {
      globe.width(cw).height(ch);
    }
  } catch (e) { /* ignore sizing */ }

  try { globe.pointOfView(initialView, 0); } catch (e) { /* ignore */ }

  // Post-construction checks (canvas/WebGL + camera sanity)
  try { postConstructionChecksTop(globe, container, initialView, { log, warn, error }); } catch (e) { /* ignore */ }

  // Expose runtime controls for testing only
  try {
    window.setLonFlip = function (enable) {
      try {
        window.worldleFlipLon = Boolean(enable);
        const newList = buildProcessedFeatures(window.worldleFlipLon);
        globe.polygonsData(newList);
        info('setLonFlip', { enabled: window.worldleFlipLon, renderCount: newList.length });
      } catch (e) { warn('setLonFlip failed', e); }
    };
    window.toggleLonFlip = function () { window.setLonFlip(!Boolean(window.worldleFlipLon)); };
    // Backwards-compatible alias retaining previous API name but now
    // performs longitude normalization (no negation).
    window.setLonNormalize = window.setLonFlip;
    window.toggleLonNormalize = window.toggleLonFlip;
  } catch (e) { /* ignore */ }

  // Configure orbit controls using top-level helper
  try { configureControlsTop(globe, { info }); } catch (e) { /* non-fatal */ }



  // Live debug overlay: use top-level creator to avoid closure bloat
  try {
    createDebugPanelTop(globe);
    // debug panel created but not exposed globally in production builds
  } catch (e) { /* non-fatal */ }

  // Create the worldMapInst stub and wire halo manager
  let worldMapInst = null;
  try {
    const { stub, toggleAntarcticaDisplay } = createRuntimeStubTop(renderFeatures, globe, { log, info, warn });
    stub.globe = globe;  // store globe reference for theme system

    // Wire halo manager for target country halos
    try {
      if (typeof createHaloManager === 'function') {
        const haloMgr = createHaloManager(globe, HALO_CONFIG);
        info('halo manager created', HALO_CONFIG);

        stub.showLocationHalo = (country, opts = {}) => {
          info('showLocationHalo called for', country?.properties?.name);
          try {
            haloMgr.showHaloForCountry(country, opts);
          } catch (e) {
            warn('showLocationHalo failed', e);
          }
        };

        const origResetRoundState = stub.resetRoundState;
        stub.resetRoundState = function () {
          try { origResetRoundState(); } catch (e) { /* ignore */ }
          try { haloMgr.reset(); } catch (e) { /* ignore */ }
        };
      } else {
        warn('halo manager not available');
      }
    } catch (e) {
      warn('halo manager setup failed', e);
    }

    // expose a toggle helper for runtime testing
    window.toggleAntarcticaDisplay = toggleAntarcticaDisplay;
    worldMapInst = stub;
  } catch (e) { /* ignore */ }

  // Install debug helpers (hover inspection, click inspection, etc.)
  try {
    installDebugHelpers();
  } catch (e) {
    warn('installDebugHelpers failed', e);
  }

  // Wire polygon click to worldMapInst.markTarget for convenient debugging
  // Only enabled when debug mode is on
  try {
    globe.onPolygonClick((d) => {
      if (!d) return;
      if (!window.__WORLDLE_DEBUG__) return;
      try { worldMapInst?.markTarget(d); } catch (e) { /* ignore */ }
    });
  } catch (e) { /* ignore */ }

  return worldMapInst;
}

