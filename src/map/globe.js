// Responsibility: render a globe into #globeViz using provided GeoJSON.
// Bootstrap loads the GeoJSON and calls `createWorldleGlobe(geojson)`.

import { createHaloManager } from './globe-halo.js';
import { installDebugHelpers } from '../app/debug.js';
import { worldleLiteLogger } from '../app/logger.js';
import { gameConfig } from '../config.js';
import { gameConstants } from '../constants.js';
import Globe from 'globe.gl';

// Top-level helpers pulled out of the `createWorldleGlobe` closure so they
// can be inspected and tested independently. They accept explicit
// parameters (including logger functions) instead of relying on closure
// variables.
// Configuration constants (extracted for clarity and easy tuning)
const DEFAULT_DESIRED_CAMERA_DISTANCE = 1.3;
const HIDE_ANTARCTICA_DEFAULT = true;
const DEBUG_PANEL_MIN_WIDTH = '220px';
const HALO_CONFIG = {
  color: '#dc2626',
  duration: 1800,
  maxRadius: 150, // pixels for canvas overlay (not 3D scale)
  easing: 'circleOut',
};
const noop = (..._args) => {};

// Top-level: get country colors based on current theme from constants
// Returns the appropriate color set for light or dark theme
const getCountryColorsTop = ({ theme = 'light' } = {}) => {
  const colors = gameConstants.COUNTRY_COLORS;
  return colors[theme] || colors.light;
};

// Top-level: get globe canvas background color for the given theme
const getGlobeBackground = ({ theme = 'light' } = {}) => {
  const backgrounds = gameConstants.GLOBE_BACKGROUND;
  return backgrounds[theme] || backgrounds.light;
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
    perFeature: [],
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
        const pf =
          stats.perFeature[featureIdx] ||
          (stats.perFeature[featureIdx] = {
            coords: 0,
            minLon: Infinity,
            maxLon: -Infinity,
            minLat: Infinity,
            maxLat: -Infinity,
            maxAbs: 0,
          });
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
    stats.perFeature[i] = stats.perFeature[i] || {
      coords: 0,
      minLon: Infinity,
      maxLon: -Infinity,
      minLat: Infinity,
      maxLat: -Infinity,
      maxAbs: 0,
    };
    if (f && f.geometry) scanCoords(f.geometry, i);
  });

  const offenders = stats.perFeature
    .map((pf, idx) => ({ idx, maxAbs: pf.maxAbs || 0, coords: pf.coords || 0 }))
    .sort((a, b) => b.maxAbs - a.maxAbs)
    .slice(0, 6);
  stats.topOffenders = offenders;
  return stats;
};

const getGlobeMeshRadiusTop = (mesh) => {
  if (!mesh?.geometry) return null;

  if (!mesh.geometry.boundingSphere) {
    mesh.geometry.computeBoundingSphere();
  }

  return mesh.geometry.boundingSphere && mesh.geometry.boundingSphere.radius * (mesh.scale?.x || 1);
};

const readGlobeDebugSnapshotTop = (globe) => {
  const pov = typeof globe.pointOfView === 'function' ? globe.pointOfView() : null;
  const cam = typeof globe.camera === 'function' ? globe.camera() : globe.camera;
  const scene = globe.scene && globe.scene();
  const mesh = scene?.children?.find((child) => child.type === 'Mesh');
  const radius = getGlobeMeshRadiusTop(mesh);
  const dist = cam?.position
    ? Math.hypot(cam.position.x || 0, cam.position.y || 0, cam.position.z || 0)
    : null;

  return {
    pov,
    cam,
    radius,
    ratio: radius && dist ? dist / radius : null,
  };
};

const formatGlobeDebugLinesTop = ({ pov, cam, radius, ratio }) => {
  const lines = [];

  lines.push(
    'pov: ' +
      (pov
        ? `lat=${pov.lat.toFixed(3)},lng=${pov.lng.toFixed(3)},alt=${Number(pov.altitude).toFixed(3)}`
        : 'n/a')
  );

  if (cam?.position) {
    lines.push('cam.z: ' + Number(cam.position.z).toFixed(2) + ' fov:' + (cam.fov || 'n/a'));
  }

  lines.push('mesh radius: ' + (radius ? Number(radius).toFixed(2) : 'n/a'));
  lines.push('dist/radius: ' + (ratio ? Number(ratio).toFixed(2) : 'n/a'));

  return lines.join('\n');
};

const runDebugRafTop = (globe, dbgText, scheduleNext) => {
  try {
    const snapshot = readGlobeDebugSnapshotTop(globe);
    dbgText.textContent = formatGlobeDebugLinesTop(snapshot);
  } catch (e) {
    /* ignore */
  }

  scheduleNext();
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
      runDebugRafTop(globe, dbgText, () => {
        rafId = requestAnimationFrame(updateDebug);
      });
    };

    const start = () => {
      if (!rafId) rafId = requestAnimationFrame(updateDebug);
      dbg.style.display = 'block';
    };
    const stop = () => {
      dbg.style.display = 'none';
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
    const toggle = () => {
      if (dbg.style.display === 'none') start();
      else stop();
    };
    start();
    return { element: dbg, start, stop, toggle };
  } catch (e) {
    /* non-fatal */ return null;
  }
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
    countryOrName?.properties?.name || countryOrName?.properties?.displayName || countryOrName || ''
  )
    .trim()
    .toLowerCase();

// Top-level: find a feature in a polygon data array by normalized country name.
const findFeatureByNameTop = (data, country) => {
  if (!Array.isArray(data)) return null;
  const name = normalizeCountryNameTop(country);
  return data.find((f) => normalizeCountryNameTop(f) === name) || null;
};

const shouldRenderFeatureTop = (feature, hideAntarctica = HIDE_ANTARCTICA_DEFAULT) => {
  try {
    const name =
      feature?.properties?.name || feature?.properties?.NAME || feature?.properties?.ADMIN;
    const excluded = feature?.properties?.EXCLUDED;

    if (hideAntarctica && String(name).toLowerCase() === 'antarctica') {
      return false;
    }

    return !excluded;
  } catch (e) {
    return true;
  }
};

const applyGlobeExclusionsTop = (feature, excludedBounds) => {
  if (!excludedBounds || excludedBounds.size === 0) return feature;

  const key = String(feature?.properties?.name || feature?.properties?.NAME_EN || '')
    .trim()
    .toLowerCase();
  const boxes = excludedBounds.get(key);

  if (!boxes || !boxes.length || feature?.geometry?.type !== 'MultiPolygon') {
    return feature;
  }

  const parts = feature.geometry.coordinates;
  if (!Array.isArray(parts) || parts.length <= 1) return feature;

  const kept = parts.filter((poly) => {
    const ring = poly[0];
    if (!Array.isArray(ring) || !ring.length) return true;

    let sumLon = 0;
    let sumLat = 0;

    for (const pt of ring) {
      sumLon += pt[0];
      sumLat += pt[1];
    }

    const cLon = sumLon / ring.length;
    const cLat = sumLat / ring.length;

    return !boxes.some(
      ([minLon, minLat, maxLon, maxLat]) =>
        cLon >= minLon && cLon <= maxLon && cLat >= minLat && cLat <= maxLat
    );
  });

  if (kept.length === parts.length) return feature;

  const finalParts = kept.length > 0 ? kept : [parts[0]];

  return {
    ...feature,
    geometry: {
      type: finalParts.length === 1 ? 'Polygon' : 'MultiPolygon',
      coordinates: finalParts.length === 1 ? finalParts[0] : finalParts,
    },
  };
};

const cloneAndFlipCoordinatesTop = (obj) => {
  if (Array.isArray(obj)) {
    if (obj.length >= 2 && typeof obj[0] === 'number' && typeof obj[1] === 'number') {
      const rest = obj.slice(2);
      return [-Number(obj[0]), Number(obj[1]), ...rest];
    }

    return obj.map(cloneAndFlipCoordinatesTop);
  }

  if (obj && typeof obj === 'object') {
    const out = {};

    for (const key of Object.keys(obj)) {
      out[key] = cloneAndFlipCoordinatesTop(obj[key]);
    }

    return out;
  }

  return obj;
};

const buildProcessedFeaturesTop = (renderFeatures, flipped) => {
  if (!flipped) return renderFeatures;

  try {
    return renderFeatures.map((feature) => {
      try {
        if (!feature?.geometry) return feature;

        return {
          ...feature,
          geometry: cloneAndFlipCoordinatesTop(feature.geometry),
        };
      } catch (e) {
        return feature;
      }
    });
  } catch (e) {
    return renderFeatures;
  }
};

import {
  centroidFromProperties as centroidFromPropertiesTop,
  centroidFromRing as centroidFromRingTop,
  largestGeometryRing as largestGeometryRingTop,
  resolveCentroid as getCountryCentroidTop,
} from './utils.js';

// Top-level: apply a state patch to a matching feature and refresh globe polygons.
// Shared by markTarget, markSolved, markWrong to eliminate repeated find-mutate-refresh boilerplate.
const applyPolygonStateTop = (globe, country, patch, { warn = (..._args) => {} } = {}) => {
  try {
    const data = typeof globe.polygonsData === 'function' ? globe.polygonsData() : null;
    if (!Array.isArray(data)) return;
    const name = normalizeCountryNameTop(country);
    for (const f of data) {
      try {
        if (normalizeCountryNameTop(f) === name && f && f.properties) {
          Object.assign(f.properties, patch);
        }
      } catch (e) {
        /* ignore per-feature errors */
      }
    }
    try {
      globe.polygonsData(data);
    } catch (e) {
      /* ignore */
    }
  } catch (e) {
    warn('applyPolygonStateTop failed', e);
  }
};

const resetRoundStateTop = (globe) => {
  try {
    const data = typeof globe.polygonsData === 'function' ? globe.polygonsData() : null;
    if (!Array.isArray(data)) return;

    for (const feature of data) {
      try {
        if (feature?.properties) {
          feature.properties._target = false;
          feature.properties._solved = false;
          feature.properties._wrong = false;
        }
      } catch (e) {
        /* ignore per-feature errors */
      }
    }

    try {
      globe.polygonsData(data);
    } catch (e) {
      /* ignore */
    }
  } catch (e) {
    /* ignore */
  }
};

const markTargetTop = (
  globe,
  country,
  { log = (..._args) => {}, warn = (..._args) => {} } = {}
) => {
  try {
    log('[globe] markTarget', country?.properties?.name ?? country);

    const data = typeof globe.polygonsData === 'function' ? globe.polygonsData() : null;
    if (Array.isArray(data)) {
      for (const feature of data) {
        try {
          if (feature?.properties) {
            feature.properties._target = false;
          }
        } catch (e) {
          /* ignore per-feature errors */
        }
      }

      const target = findFeatureByNameTop(data, country);
      if (target?.properties) {
        try {
          target.properties._target = true;
        } catch (e) {
          /* ignore */
        }

        try {
          globe.polygonsData(data);
        } catch (e) {
          /* ignore */
        }
      }
    }

    const centroidFeature =
      findFeatureByNameTop(
        typeof globe.polygonsData === 'function' ? globe.polygonsData() : null,
        country
      ) || country;
    const centroid = getCountryCentroidTop(centroidFeature);

    if (centroid) {
      try {
        globe.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: 1.8 }, 600);
      } catch (e) {
        /* ignore */
      }
    }
  } catch (e) {
    warn('stub.markTarget failed', e);
  }
};

const zoomToCountryTop = (globe, country) => {
  try {
    const centroid = getCountryCentroidTop(country);
    if (centroid) {
      globe.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: 1.8 }, 600);
    }
  } catch (e) {
    /* ignore */
  }
};

const setRegionFilterTop = (globe, allFeatures, regionName, { info = noop, warn = noop } = {}) => {
  try {
    const activeContinentFilter = regionName ? String(regionName).trim() : null;
    const filteredFeatures = activeContinentFilter
      ? allFeatures.filter((feature) => isCountryInContinentTop(feature, activeContinentFilter))
      : allFeatures;
    globe.polygonsData(filteredFeatures);
    info('setRegionFilter applied', {
      region: activeContinentFilter,
      renderCount: filteredFeatures.length,
      totalCount: allFeatures.length,
    });
  } catch (e) {
    warn('setRegionFilter failed', e);
  }
};

const buildCountryLoadResultTop = (features) => ({
  countriesData: features,
  countryNames: features
    .map((feature) => feature.properties?.name)
    .filter(Boolean)
    .sort(),
  countryByName: new Map(
    features.map((feature) => [String(feature.properties?.name || '').toLowerCase(), feature])
  ),
});

const toggleAntarcticaDisplayTop = (globe, features, show, { info = noop, warn = noop } = {}) => {
  try {
    const shouldShow = typeof show === 'boolean' ? show : true;
    const newList = shouldShow
      ? features.filter((feature) => !feature?.properties?.EXCLUDED)
      : features.filter((feature) => shouldRenderFeatureTop(feature, true));
    globe.polygonsData(newList);
    info('toggleAntarcticaDisplay', { show: shouldShow, renderCount: newList.length });
  } catch (e) {
    warn('toggleAntarcticaDisplay failed', e);
  }
};

// Top-level: create a minimal runtime stub expected by the app.
// Extracted from `createWorldleGlobe` so it can be tested and kept small.
const createRuntimeStubTop = (
  features = [],
  globe,
  { log = (..._args) => {}, info = (..._args) => {}, warn = (..._args) => {} } = {}
) => {
  try {
    let allFeatures = Array.isArray(features) ? features : [];

    const stub = {
      resetRoundState: () => resetRoundStateTop(globe),
      markTarget: (country) => markTargetTop(globe, country, { log, warn }),
      zoomToCountry: (country) => zoomToCountryTop(globe, country),
      showLocationHalo: () => {}, // will be wired by createWorldleGlobe
      setRegionFilter: (regionName) =>
        setRegionFilterTop(globe, allFeatures, regionName, { info, warn }),
      markSolved: (country) => {
        applyPolygonStateTop(
          globe,
          country,
          { _target: false, _solved: true, _wrong: false },
          { warn }
        );
      },
      markWrong: (country) => {
        applyPolygonStateTop(
          globe,
          country,
          { _target: false, _wrong: true, _solved: false },
          { warn }
        );
      },
      loadCountries: () => Promise.resolve(buildCountryLoadResultTop(features)),
      globe: null, // will be set after globe instance is created
    };

    const toggleAntarcticaDisplay = (show) =>
      toggleAntarcticaDisplayTop(globe, features, show, { info, warn });

    return { stub, toggleAntarcticaDisplay };
  } catch (e) {
    warn('createRuntimeStubTop failed', e);
    return { stub: null, toggleAntarcticaDisplay: () => {} };
  }
};

// Top-level: create a Globe instance with standard polygon accessors.
const createGlobeInstanceTop = (
  container,
  globeImg,
  renderFeatures,
  initialFlip,
  polygonsDataProvider
) => {
  const polygonsData = polygonsDataProvider(initialFlip);

  const fallbackTheme = document.documentElement?.dataset?.theme || 'light';
  const fallbackCountryColors = getCountryColorsTop({ theme: fallbackTheme });

  const globe = new Globe(container)
    .backgroundColor(getGlobeBackground({ theme: fallbackTheme }))
    .globeImageUrl(globeImg)
    .globeOffset([0, 0])
    .polygonsData(polygonsData)
    .polygonGeoJsonGeometry('geometry')
    .polygonAltitude(() => 0.005)
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
      } catch (e) {
        /* ignore */
      }
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
      } catch (e) {
        /* ignore */
      }
      return fallbackCountryColors.stroke;
    })
    .onPolygonHover((d) => {
      container.style.cursor = d ? 'pointer' : 'auto';
    });
  return globe;
};

// Top-level: perform post-construction checks (canvas/WebGL + camera sanity)
const postConstructionChecksTop = (
  globe,
  container,
  initialView,
  { log = (..._args) => {}, warn = (..._args) => {}, error = (..._args) => {} } = {}
) => {
  requestAnimationFrame(() => {
    try {
      const canvas = container.querySelector('canvas');
      log('globe canvas present?', Boolean(canvas));
      if (canvas) {
        const gl =
          canvas.getContext &&
          (canvas.getContext('webgl2') ||
            canvas.getContext('webgl') ||
            canvas.getContext('experimental-webgl'));
        log('webgl present?', Boolean(gl));
        if (gl) {
          try {
            const vendor = gl.getParameter(gl.VENDOR);
            const renderer = gl.getParameter(gl.RENDERER);
            const version = gl.getParameter(gl.VERSION);
            log('GL info', { vendor, renderer, version });
          } catch (e) {
            /* ignore reading params on some contexts */
          }
        }
      }

      try {
        const cam = typeof globe.camera === 'function' ? globe.camera() : globe.camera;
        if (cam && cam.position) {
          const { x, y, z } = cam.position;
          if (![x, y, z].every(Number.isFinite)) {
            warn('camera position invalid — applying safe default');
            try {
              globe.pointOfView(initialView, 0);
              const controls = globe.controls && globe.controls();
              if (controls && typeof controls.update === 'function') controls.update();
            } catch (e) {
              /* ignore */
            }
          }
        }
      } catch (e) {
        /* ignore camera fixes */
      }
    } catch (e) {
      error('post-construction checks failed', e);
    }
  });
};

// Top-level: configure orbit controls for consistent behavior
const configureControlsTop = (globe, { info = (..._args) => {} } = {}) => {
  try {
    const controls = globe.controls();
    if (!controls) return;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.rotateSpeed = 0.6;
    const globeRadiusAbs = typeof globe.getGlobeRadius === 'function' ? globe.getGlobeRadius() : 1;
    // Set minDistance to prevent zooming through polygons (which render at altitude 0.005)
    controls.minDistance = Math.max(1.05, globeRadiusAbs * 1.05);
    controls.maxDistance = Math.max(3, globeRadiusAbs * 10);
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI - 0.2;
    if (typeof controls.target?.set === 'function') controls.target.set(0, 0, 0);
    if (typeof controls.update === 'function') controls.update();
    info('configureControlsTop applied', {
      minDistance: controls.minDistance,
      maxDistance: controls.maxDistance,
    });
  } catch (e) {
    /* non-fatal */
  }
};

const exposeGeoStatsTop = (features, { info = noop, warn = noop } = {}) => {
  try {
    const geoStats = computeGeoStats(features);
    info('geoStats', {
      features: geoStats.features,
      totalCoords: geoStats.totalCoords,
      minLon: geoStats.minLon,
      maxLon: geoStats.maxLon,
      minLat: geoStats.minLat,
      maxLat: geoStats.maxLat,
      maxAbs: geoStats.maxAbs,
      topOffenders: geoStats.topOffenders,
    });
    window.worldleLiteGeoStats = geoStats;
  } catch (e) {
    warn('computeGeoStats failed', e);
  }
};

const getGlobeImageTop = () => {
  const themePref = document.documentElement?.dataset?.theme || 'light';
  return themePref === 'dark' ? 'img/earth-dark.jpg' : 'img/earth-light.jpg';
};

const buildRenderFeaturesTop = (
  features,
  excludedBounds,
  hideAntarctica = HIDE_ANTARCTICA_DEFAULT
) =>
  Array.isArray(features)
    ? features
        .filter((feature) => shouldRenderFeatureTop(feature, hideAntarctica))
        .map((feature) => applyGlobeExclusionsTop(feature, excludedBounds))
    : [];

const exposeGlobeDiagnosticsTop = ({ info = noop, warn = noop } = {}) => {
  try {
    const globeScript = Array.from(document.querySelectorAll('script')).find((script) =>
      (script.src || '').includes('globe.gl')
    );
    const globeVersion =
      typeof Globe !== 'undefined' && Globe.version
        ? Globe.version
        : typeof Globe !== 'undefined'
          ? 'defined-no-version'
          : 'undefined';
    info('globe:init', { scriptSrc: globeScript ? globeScript.src : null, version: globeVersion });
    window.globeLibInfo = {
      scriptSrc: globeScript ? globeScript.src : null,
      version: globeVersion,
    };
  } catch (e) {
    warn('globe:init diagnostics failed', e);
  }
};

const sizeGlobeToContainerTop = (globe, container) => {
  try {
    const cw = container.clientWidth || container.offsetWidth || null;
    const ch = container.clientHeight || container.offsetHeight || null;
    if (cw && ch && typeof globe.width === 'function' && typeof globe.height === 'function') {
      globe.width(cw).height(ch);
    }
  } catch (e) {
    /* ignore sizing */
  }
};

const installLonFlipControlsTop = (globe, renderFeatures, { info = noop, warn = noop } = {}) => {
  try {
    window.setLonFlip = function (enable) {
      try {
        window.worldleFlipLon = Boolean(enable);
        const newList = buildProcessedFeaturesTop(renderFeatures, window.worldleFlipLon);
        globe.polygonsData(newList);
        info('setLonFlip', { enabled: window.worldleFlipLon, renderCount: newList.length });
      } catch (e) {
        warn('setLonFlip failed', e);
      }
    };
    window.toggleLonFlip = function () {
      window.setLonFlip(!Boolean(window.worldleFlipLon));
    };
    window.setLonNormalize = window.setLonFlip;
    window.toggleLonNormalize = window.toggleLonFlip;
  } catch (e) {
    /* ignore */
  }
};

import { createHaloAdapter } from './halo.js';

const attachHaloManagerTop = (stub, globe, haloFactory, { info = noop, warn = noop } = {}) => {
  try {
    if (typeof haloFactory !== 'function') {
      warn('halo manager not available');
      return;
    }

    const haloMgr = haloFactory(globe, HALO_CONFIG);
    info('halo manager created', HALO_CONFIG);

    const adapter = createHaloAdapter(haloMgr, null);
    stub.showLocationHalo = (country, opts = {}) => {
      info('showLocationHalo called for', country?.properties?.name);
      try {
        adapter.showLocationHalo(country, opts);
      } catch (e) {
        warn('showLocationHalo failed', e);
      }
    };

    const origResetRoundState = stub.resetRoundState;
    stub.resetRoundState = function () {
      try {
        origResetRoundState();
      } catch (e) {
        /* ignore */
      }
      try {
        haloMgr.reset();
      } catch (e) {
        /* ignore */
      }
    };
  } catch (e) {
    warn('halo manager setup failed', e);
  }
};

const installDebugPolygonClickTop = (globe, worldMapInst) => {
  try {
    globe.onPolygonClick((d) => {
      if (!d) return;
      if (!window.__WORLDLE_DEBUG__) return;
      try {
        worldMapInst?.markTarget(d);
      } catch (e) {
        /* ignore */
      }
    });
  } catch (e) {
    /* ignore */
  }
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

  exposeGeoStatsTop(features, { info, warn });
  info('createWorldleGlobe: initializing', { countries: features.length });

  const globeImg = getGlobeImageTop();

  // Temporarily filter out Antarctica for rendering to avoid oversized mesh issues.
  // This does not remove the feature from the app state; it's only for the globe layer.
  const SHOULD_HIDE_ANTARCTICA = HIDE_ANTARCTICA_DEFAULT;
  // Strip explicitly excluded polygon parts (e.g. French Guiana from France)
  // using the bounding-box exceptions configured in gameConfig.
  const excludedBounds = gameConfig.COUNTRY_EXCLUDED_POLYGON_BOUNDS;

  const renderFeatures = buildRenderFeaturesTop(features, excludedBounds, SHOULD_HIDE_ANTARCTICA);

  info('globe: rendering features', {
    total: features.length,
    renderCount: renderFeatures.length,
    hiddenAntarctica: features.length - renderFeatures.length,
  });

  // Helper: produce the features passed to Globe.gl, optionally flipping
  // longitudes when `flipped` is truthy.
  const initialFlip = Boolean(window.worldleFlipLon);
  const globe = createGlobeInstanceTop(
    container,
    globeImg,
    renderFeatures,
    initialFlip,
    (flipped) => buildProcessedFeaturesTop(renderFeatures, flipped)
  );

  // Startup diagnostics: record which Globe.gl script was loaded and any
  // available `Globe.version`. This helps quickly determine whether a
  // vendored or CDN build is in use when oversized meshes appear.
  exposeGlobeDiagnosticsTop({ info, warn });

  // Note: mesh normalization was intentionally removed to keep all
  // coordinate scaling deterministic at build time. Ensure the input
  // GeoJSON is valid (lon/lat) so the globe renders at correct scale.

  // Minimal initial view (conservative zoomed-out start). Use globe radii.
  const initialView = { lat: 0, lng: 0, altitude: DEFAULT_DESIRED_CAMERA_DISTANCE };
  // Ensure the internal canvas matches the container size so the globe
  // appears centered and occupies the expected layout area.
  sizeGlobeToContainerTop(globe, container);

  try {
    globe.pointOfView(initialView, 0);
  } catch (e) {
    /* ignore */
  }

  // Post-construction checks (canvas/WebGL + camera sanity)
  try {
    postConstructionChecksTop(globe, container, initialView, { log, warn, error });
  } catch (e) {
    /* ignore */
  }

  // Expose runtime controls for testing only
  installLonFlipControlsTop(globe, renderFeatures, { info, warn });

  // Configure orbit controls using top-level helper
  try {
    configureControlsTop(globe, { info });
  } catch (e) {
    /* non-fatal */
  }

  // Live debug overlay: use top-level creator to avoid closure bloat
  try {
    if (window.__WORLDLE_DEBUG__) {
      worldleLiteLogger.debug('Debug mode enabled; creating debug panel');
      createDebugPanelTop(globe);
    }
    // debug panel created but not exposed globally in production builds
  } catch (e) {
    /* non-fatal */
  }

  // Create the worldMapInst stub and wire halo manager
  let worldMapInst = null;
  try {
    const { stub, toggleAntarcticaDisplay } = createRuntimeStubTop(renderFeatures, globe, {
      log,
      info,
      warn,
    });
    stub.globe = globe; // store globe reference for theme system

    attachHaloManagerTop(stub, globe, createHaloManager, { info, warn });

    // expose a toggle helper for runtime testing
    window.toggleAntarcticaDisplay = toggleAntarcticaDisplay;
    worldMapInst = stub;
  } catch (e) {
    /* ignore */
  }

  // Install debug helpers (hover inspection, click inspection, etc.)
  try {
    installDebugHelpers();
  } catch (e) {
    warn('installDebugHelpers failed', e);
  }

  // Wire polygon click to worldMapInst.markTarget for convenient debugging
  // Only enabled when debug mode is on
  installDebugPolygonClickTop(globe, worldMapInst);

  return worldMapInst;
}

export {
  applyGlobeExclusionsTop,
  buildProcessedFeaturesTop,
  centroidFromPropertiesTop,
  centroidFromRingTop,
  formatGlobeDebugLinesTop,
  getCountryCentroidTop,
  largestGeometryRingTop,
  markTargetTop,
  readGlobeDebugSnapshotTop,
};
