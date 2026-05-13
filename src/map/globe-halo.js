/**
 * @fileoverview Globe halo manager — Canvas overlay-based expanding rings for target countries.
 *
 * Projects country centroids to screen space, draws animated expanding rings on a 2D canvas
 * overlay using RAF. Handles visibility checking and automatic cleanup.
 *
 * Usage:
 *   const haloMgr = createHaloManager(globe, config);
 *   haloMgr.showHaloForCountry(country, opts);  // auto-resolves centroid
 *   haloMgr.showHalo(lon, lat, opts);           // direct lon/lat
 *   haloMgr.destroy();
 */

import { worldleLiteLogger as log } from '../app/logger.js';
import { lonLatTo3D } from './utils.js';

const DEFAULT_HALO_CONFIG = {
  color: '#f5c518',
  duration: 1800,
  maxRadius: 40,
  easing: 'circleOut',
};

const createEmptyHaloManager = () => ({
  showHalo: () => {},
  showHaloForCountry: () => {},
  reset: () => {},
  destroy: () => {},
});

const getHaloConfig = (config = {}) => ({
  color: config.color || DEFAULT_HALO_CONFIG.color,
  duration: config.duration !== undefined ? config.duration : DEFAULT_HALO_CONFIG.duration,
  maxRadius: config.maxRadius !== undefined ? config.maxRadius : DEFAULT_HALO_CONFIG.maxRadius,
  easing: config.easing || DEFAULT_HALO_CONFIG.easing,
});

const project3DToScreen = (globe, canvas, pos3d) => {
  try {
    const scene = globe.scene && globe.scene();
    const camera =
      globe.camera && (typeof globe.camera === 'function' ? globe.camera() : globe.camera);

    if (!scene || !camera) {
      console.warn('[halo] cannot access globe scene or camera');
      return null;
    }

    const renderer =
      globe.renderer && (typeof globe.renderer === 'function' ? globe.renderer() : globe.renderer);
    if (!renderer || !renderer.domElement) {
      console.warn('[halo] cannot access globe renderer or dom element');
      return null;
    }

    const THREE = window.THREE;
    if (!THREE || !THREE.Vector3) {
      console.warn('[halo] Three.js Vector3 not available');
      return null;
    }

    const vec3d = new THREE.Vector3(pos3d.x, pos3d.y, pos3d.z);
    vec3d.project(camera);

    const screenX = ((vec3d.x + 1) * canvas.width) / 2;
    const screenY = ((1 - vec3d.y) * canvas.height) / 2;

    if (vec3d.z > 1 || vec3d.z < 0) {
      console.warn('[halo] point outside camera frustum', { z: vec3d.z });
      return null;
    }

    if (
      screenX < -100 ||
      screenX > canvas.width + 100 ||
      screenY < -100 ||
      screenY > canvas.height + 100
    ) {
      console.warn('[halo] projected coordinates way off-screen', {
        screenX,
        screenY,
      });
      return null;
    }

    return { x: screenX, y: screenY };
  } catch (e) {
    console.warn('[halo] projection failed', e);
    return null;
  }
};

const drawHaloFrame = (ctx, halos, now, getEasing, { canvas, debug = () => {} } = {}) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = halos.length - 1; i >= 0; i--) {
    const halo = halos[i];
    const elapsed = now - halo.startTime;
    const progress = Math.min(1, elapsed / halo.duration);

    if (progress >= 1) {
      halos.splice(i, 1);
      continue;
    }

    const eased = getEasing(halo.easing)(progress);
    const radius = eased * halo.maxRadius;
    const opacity = 1 - progress;

    if (!Number.isFinite(halo.screenX) || !Number.isFinite(halo.screenY)) {
      console.warn('[halo] invalid screen coordinates', {
        screenX: halo.screenX,
        screenY: halo.screenY,
      });
      halos.splice(i, 1);
      continue;
    }

    ctx.strokeStyle = halo.color;
    ctx.globalAlpha = opacity * 0.8;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(halo.screenX, halo.screenY, radius, 0, Math.PI * 2);
    ctx.stroke();

    if (progress < 0.05) {
      debug('[halo] frame', {
        progress: progress.toFixed(3),
        radius: radius.toFixed(1),
        pos: [halo.screenX.toFixed(0), halo.screenY.toFixed(0)],
        canvasSize: [canvas.width, canvas.height],
        opacity: opacity.toFixed(2),
      });
    }

    if (progress < 0.3) {
      ctx.fillStyle = halo.color;
      ctx.globalAlpha = opacity * 0.3 * (1 - progress / 0.3);
      ctx.beginPath();
      ctx.arc(halo.screenX, halo.screenY, radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
};

const centroidFromProperties = (properties) => {
  if (
    properties &&
    Array.isArray(properties.geometryCenter) &&
    properties.geometryCenter.length >= 2
  ) {
    return { lat: properties.geometryCenter[1], lng: properties.geometryCenter[0] };
  }

  if (
    properties &&
    Array.isArray(properties.geometryBounds) &&
    properties.geometryBounds.length >= 4
  ) {
    const [minLon, minLat, maxLon, maxLat] = properties.geometryBounds;
    return { lat: (minLat + maxLat) / 2, lng: (minLon + maxLon) / 2 };
  }

  return null;
};

const firstGeometryRing = (geometry) => {
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates?.[0]?.[0] || null;
  if (geometry?.type === 'Polygon') return geometry.coordinates?.[0] || null;
  return null;
};

const centroidFromRing = (parts) => {
  if (!Array.isArray(parts) || !parts.length) return null;

  let sumLon = 0;
  let sumLat = 0;
  let count = 0;

  for (const pt of parts) {
    if (Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1])) {
      sumLon += pt[0];
      sumLat += pt[1];
      count += 1;
    }
  }

  if (count > 0) {
    return { lat: sumLat / count, lng: sumLon / count };
  }

  return null;
};

// Helper: resolve country centroid from feature properties or geometry
const resolveCentroid = (country) => {
  if (!country) return null;

  const propertyCentroid = centroidFromProperties(country.properties);
  if (propertyCentroid) return propertyCentroid;

  // Compute from geometry (first polygon)
  if (country.geometry) {
    try {
      return centroidFromRing(firstGeometryRing(country.geometry));
    } catch (e) {
      // ignore geometry parsing errors
    }
  }

  return null;
};

const getGlobeContainer = () => {
  const globeCanvas = document.querySelector('canvas');
  if (!globeCanvas?.parentElement) return null;

  return {
    globeCanvas,
    container: globeCanvas.parentElement,
  };
};

const ensureRelativeContainer = (container) => {
  const originalPosition = container.style.position;
  if (!originalPosition || originalPosition === 'static') {
    container.style.position = 'relative';
  }
};

const ensureOverlayCanvas = (container) => {
  let canvas = document.getElementById('halo-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'halo-canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '10';
    canvas.style.backgroundColor = 'transparent';
    container.appendChild(canvas);
  }

  return canvas;
};

const syncHaloCanvasSize = (canvas, globeCanvas) => {
  canvas.width = globeCanvas.offsetWidth;
  canvas.height = globeCanvas.offsetHeight;
};

const logHaloCanvasSetup = (container, canvas, globeCanvas) => {
  log.debug('[halo] canvas setup', {
    containerId: container.id,
    containerPosition: container.style.position,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    globeCanvasSize: { w: globeCanvas.offsetWidth, h: globeCanvas.offsetHeight },
  });
};

const lonLatToScreenTop = (globe, canvas, lon, lat) => {
  try {
    if (typeof globe.getScreenCoords === 'function') {
      const screenCoords = globe.getScreenCoords(lat, lon);
      if (screenCoords && Number.isFinite(screenCoords.x) && Number.isFinite(screenCoords.y)) {
        log.debug('[halo] projection via globe.getScreenCoords', { lat, lon, screenCoords });
        return screenCoords;
      }
    }
  } catch (e) {
    console.warn('[halo] globe.getScreenCoords failed', e);
  }

  try {
    const pos3d = lonLatTo3D(lon, lat);
    return project3DToScreen(globe, canvas, pos3d);
  } catch (e) {
    console.warn('[halo] fallback projection also failed', e);
    return null;
  }
};

const createHaloEntry = (lon, lat, screenPos, opts, cfg) => ({
  lon,
  lat,
  screenX: screenPos.x,
  screenY: screenPos.y,
  startTime: opts.startTime !== undefined ? opts.startTime : Date.now(),
  duration: opts.duration !== undefined ? opts.duration : cfg.duration,
  maxRadius: opts.maxRadius !== undefined ? opts.maxRadius : cfg.maxRadius,
  easing: opts.easing || cfg.easing,
  color: opts.color || cfg.color,
});

const scheduleHaloUpdate = (activeHalos, rafIdRef, updateHalos) => {
  if (!rafIdRef.current && activeHalos.length > 0) {
    rafIdRef.current = requestAnimationFrame(updateHalos);
  }
};

const resetHalosTop = (activeHalos, ctx, canvas, rafIdRef) => {
  activeHalos.length = 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (rafIdRef.current) {
    cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = null;
  }
};

const destroyHaloManagerTop = (reset, canvas, handleResize) => {
  reset();
  window.removeEventListener('resize', handleResize);
  if (canvas.parentElement) {
    canvas.parentElement.removeChild(canvas);
  }
};

const createHaloManager = (globe, config = {}) => {
  if (!globe || typeof globe.scene !== 'function') {
    console.error('[halo] globe object required');
    return createEmptyHaloManager();
  }

  const cfg = getHaloConfig(config);

  const globeDom = getGlobeContainer();
  if (!globeDom) {
    console.error('[halo] cannot find globe container');
    return createEmptyHaloManager();
  }

  const { globeCanvas, container } = globeDom;
  ensureRelativeContainer(container);
  const canvas = ensureOverlayCanvas(container);
  syncHaloCanvasSize(canvas, globeCanvas);
  logHaloCanvasSetup(container, canvas, globeCanvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[halo] canvas 2d context failed');
    return createEmptyHaloManager();
  }

  const activeHalos = [];
  const rafIdRef = { current: null };

  const easings = {
    linear: (t) => t,
    circleOut: (t) => 1 - Math.sqrt(1 - t * t),
    easeOut: (t) => 1 - (1 - t) ** 3,
  };

  const getEasing = (name) => easings[name] || easings.circleOut;

  const showHalo = (lon, lat, opts = {}) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      console.warn('[halo] invalid coordinates', { lon, lat });
      return;
    }

    const screenPos = lonLatToScreenTop(globe, canvas, lon, lat);
    if (!screenPos) {
      console.warn('[halo] cannot project to screen', { lon, lat });
      return;
    }

    log.debug('[halo] showHalo', {
      lon,
      lat,
      screenPos,
      canvasSize: { w: canvas.width, h: canvas.height },
      screenPosValid: Number.isFinite(screenPos.x) && Number.isFinite(screenPos.y),
    });

    activeHalos.push(createHaloEntry(lon, lat, screenPos, opts, cfg));
    scheduleHaloUpdate(activeHalos, rafIdRef, updateHalos);
  };

  const showHaloForCountry = (country, opts = {}) => {
    if (!country) return;

    const centroid = resolveCentroid(country);
    if (!centroid) {
      console.warn('[halo] could not resolve centroid for', country.properties?.name);
      return;
    }

    showHalo(centroid.lng, centroid.lat, opts);
  };

  const updateHalos = () => {
    const now = Date.now();
    drawHaloFrame(ctx, activeHalos, now, getEasing, {
      canvas,
      debug: log.debug,
    });

    if (activeHalos.length > 0) {
      rafIdRef.current = requestAnimationFrame(updateHalos);
    } else {
      rafIdRef.current = null;
    }
  };

  const reset = () => resetHalosTop(activeHalos, ctx, canvas, rafIdRef);
  const handleResize = () => syncHaloCanvasSize(canvas, globeCanvas);
  const destroy = () => destroyHaloManagerTop(reset, canvas, handleResize);

  window.addEventListener('resize', handleResize);

  log.debug('[halo] canvas overlay initialized', cfg);

  return {
    showHalo,
    showHaloForCountry,
    reset,
    destroy,
  };
};

export { createHaloManager, drawHaloFrame, project3DToScreen, resolveCentroid };
