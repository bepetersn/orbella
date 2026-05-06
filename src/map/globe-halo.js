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

// Helper: resolve country centroid from feature properties or geometry
const resolveCentroid = (country) => {
  if (!country) return null;
  
  const p = country.properties;
  
  // Try pre-computed centroid in properties
  if (p && Array.isArray(p.geometryCenter) && p.geometryCenter.length >= 2) {
    return { lat: p.geometryCenter[1], lng: p.geometryCenter[0] };
  }
  
  // Try bounds in properties
  if (p && Array.isArray(p.geometryBounds) && p.geometryBounds.length >= 4) {
    const [minLon, minLat, maxLon, maxLat] = p.geometryBounds;
    return { lat: (minLat + maxLat) / 2, lng: (minLon + maxLon) / 2 };
  }
  
  // Compute from geometry (first polygon)
  if (country.geometry) {
    try {
      const parts = country.geometry.type === 'MultiPolygon'
        ? country.geometry.coordinates[0][0]
        : country.geometry.type === 'Polygon'
          ? country.geometry.coordinates[0]
          : null;
      
      if (Array.isArray(parts) && parts.length) {
        let sumLon = 0, sumLat = 0, count = 0;
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
      }
    } catch (e) {
      // ignore geometry parsing errors
    }
  }
  
  return null;
};

const createHaloManager = (globe, config = {}) => {
  if (!globe || typeof globe.scene !== 'function') {
    console.error('[halo] globe object required');
    return {
      showHalo: () => {},
      showHaloForCountry: () => {},
      reset: () => {},
      destroy: () => {}
    };
  }

  const cfg = {
    color: config.color || '#f5c518',
    duration: config.duration !== undefined ? config.duration : 1800,
    maxRadius: config.maxRadius !== undefined ? config.maxRadius : 40,
    easing: config.easing || 'circleOut'
  };

  // Get container - find the globe's parent
  const globeCanvas = document.querySelector('canvas');
  if (!globeCanvas || !globeCanvas.parentElement) {
    console.error('[halo] cannot find globe container');
    return {
      showHalo: () => {},
      showHaloForCountry: () => {},
      reset: () => {},
      destroy: () => {}
    };
  }

  const container = globeCanvas.parentElement;

  // Ensure container has position:relative for absolute positioning to work
  const originalPosition = container.style.position;
  if (!originalPosition || originalPosition === 'static') {
    container.style.position = 'relative';
  }

  // Find or create overlay canvas
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

  // Match globe canvas size
  canvas.width = globeCanvas.offsetWidth;
  canvas.height = globeCanvas.offsetHeight;
  
  log.debug('[halo] canvas setup', { 
    containerId: container.id, 
    containerPosition: container.style.position,
    canvasWidth: canvas.width, 
    canvasHeight: canvas.height,
    globeCanvasSize: { w: globeCanvas.offsetWidth, h: globeCanvas.offsetHeight }
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[halo] canvas 2d context failed');
    return {
      showHalo: () => {},
      showHaloForCountry: () => {},
      reset: () => {},
      destroy: () => {}
    };
  }

  // State
  const activeHalos = [];
  let rafId = null;

  // Easing functions
  const easings = {
    linear: (t) => t,
    circleOut: (t) => 1 - Math.sqrt(1 - t * t),
    easeOut: (t) => 1 - (1 - t) ** 3
  };

  const getEasing = (name) => easings[name] || easings.circleOut;

  // Convert lon/lat to 3D world position on globe surface
  const lonLatTo3D = (lon, lat) => {
    // Convert to radians and project to sphere of radius 1
    const radLat = lat * Math.PI / 180;
    const radLon = lon * Math.PI / 180;
    const x = Math.cos(radLat) * Math.cos(radLon);
    const y = Math.sin(radLat);
    const z = Math.cos(radLat) * Math.sin(radLon);
    return { x, y, z };
  };

  // Project 3D world position to 2D screen coords using Globe.gl's camera
  const project3DToScreen = (pos3d) => {
    try {
      const scene = globe.scene && globe.scene();
      const camera = globe.camera && (typeof globe.camera === 'function' ? globe.camera() : globe.camera);
      
      if (!scene || !camera) {
        console.warn('[halo] cannot access globe scene or camera');
        return null;
      }

      // Get renderer
      const renderer = globe.renderer && (typeof globe.renderer === 'function' ? globe.renderer() : globe.renderer);
      if (!renderer || !renderer.domElement) {
        console.warn('[halo] cannot access globe renderer or dom element');
        return null;
      }

      // Get Three.js if available (it's bundled in globe.gl)
      const THREE = window.THREE;
      if (!THREE || !THREE.Vector3) {
        console.warn('[halo] Three.js Vector3 not available');
        return null;
      }

      // Create Vector3 for the world position
      const vec3d = new THREE.Vector3(pos3d.x, pos3d.y, pos3d.z);
      
      // Project the point using the camera's projection matrix
      // This converts world coordinates to normalized device coordinates (-1 to 1)
      vec3d.project(camera);

      // Convert from NDC to pixel coordinates
      // X: from [-1, 1] to [0, canvas.width]
      // Y: from [1, -1] to [0, canvas.height] (Y is inverted in canvas vs WebGL)
      const screenX = (vec3d.x + 1) * canvas.width / 2;
      const screenY = (1 - vec3d.y) * canvas.height / 2;

      // Check if point is behind camera (z > 1 means off-far-plane, z < -1 means behind camera)
      if (vec3d.z > 1 || vec3d.z < 0) {
        console.warn('[halo] point outside camera frustum', { z: vec3d.z });
        return null;
      }

      // Sanity check: coordinate should be on screen (with some tolerance for edge cases)
      if (screenX < -100 || screenX > canvas.width + 100 || 
          screenY < -100 || screenY > canvas.height + 100) {
        console.warn('[halo] projected coordinates way off-screen', { screenX, screenY });
        return null;
      }

      return { x: screenX, y: screenY };
    } catch (e) {
      console.warn('[halo] projection failed', e);
      return null;
    }
  };

  // Convert lon/lat directly to screen coords
  const lonLatToScreen = (lon, lat) => {
    // Try globe.gl's built-in getScreenCoords method first (most reliable)
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

    // Fallback to 3D projection method
    try {
      const pos3d = lonLatTo3D(lon, lat);
      return project3DToScreen(pos3d);
    } catch (e) {
      console.warn('[halo] fallback projection also failed', e);
      return null;
    }
  };

  // Show halo at specific lon/lat
  const showHalo = (lon, lat, opts = {}) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      console.warn('[halo] invalid coordinates', { lon, lat });
      return;
    }

    const screenPos = lonLatToScreen(lon, lat);
    
    // If projection failed or point is behind camera, don't show halo
    if (!screenPos) {
      console.warn('[halo] cannot project to screen', { lon, lat });
      return;
    }

    // Log with more detail about coordinates
    log.debug('[halo] showHalo', { 
      lon, 
      lat, 
      screenPos, 
      canvasSize: { w: canvas.width, h: canvas.height },
      screenPosValid: Number.isFinite(screenPos.x) && Number.isFinite(screenPos.y)
    });

    const halo = {
      lon,
      lat,
      screenX: screenPos.x,
      screenY: screenPos.y,
      startTime: opts.startTime !== undefined ? opts.startTime : Date.now(),
      duration: opts.duration !== undefined ? opts.duration : cfg.duration,
      maxRadius: opts.maxRadius !== undefined ? opts.maxRadius : cfg.maxRadius,
      easing: opts.easing || cfg.easing,
      color: opts.color || cfg.color
    };

    activeHalos.push(halo);
    
    if (!rafId) {
      rafId = requestAnimationFrame(updateHalos);
    }
  };

  // Show halo for country (auto-resolve centroid)
  const showHaloForCountry = (country, opts = {}) => {
    if (!country) return;
    
    const centroid = resolveCentroid(country);
    if (!centroid) {
      console.warn('[halo] could not resolve centroid for', country.properties?.name);
      return;
    }

    showHalo(centroid.lng, centroid.lat, opts);
  };

  // Animation loop
  const updateHalos = () => {
    const now = Date.now();
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Debug: Draw canvas border to check if it's visible
    if (false) { // set to true to debug
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
    }

    // Update and draw halos
    for (let i = activeHalos.length - 1; i >= 0; i--) {
      const halo = activeHalos[i];
      const elapsed = now - halo.startTime;
      const progress = Math.min(1, elapsed / halo.duration);

      if (progress < 1) {
        const eased = getEasing(halo.easing)(progress);
        const radius = eased * halo.maxRadius;
        const opacity = 1 - progress;

        // Validate halo screen coordinates
        if (!Number.isFinite(halo.screenX) || !Number.isFinite(halo.screenY)) {
          console.warn('[halo] invalid screen coordinates', { screenX: halo.screenX, screenY: halo.screenY });
          activeHalos.splice(i, 1);
          continue;
        }

        // Draw expanding ring
        ctx.strokeStyle = halo.color;
        ctx.globalAlpha = opacity * 0.8;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(halo.screenX, halo.screenY, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        if (progress < 0.05) {
          // Per-frame trace — only active when DEBUG is enabled (via worldleLiteLogger.debug)
          log.debug('[halo] frame', { 
            progress: progress.toFixed(3), 
            radius: radius.toFixed(1), 
            pos: [halo.screenX.toFixed(0), halo.screenY.toFixed(0)],
            canvasSize: [canvas.width, canvas.height],
            opacity: opacity.toFixed(2)
          });
        }

        // Draw fading center glow
        if (progress < 0.3) {
          ctx.fillStyle = halo.color;
          ctx.globalAlpha = opacity * 0.3 * (1 - progress / 0.3);
          ctx.beginPath();
          ctx.arc(halo.screenX, halo.screenY, radius * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        activeHalos.splice(i, 1);
      }
    }

    ctx.globalAlpha = 1;

    if (activeHalos.length > 0) {
      rafId = requestAnimationFrame(updateHalos);
    } else {
      rafId = null;
    }
  };

  // Reset all halos
  const reset = () => {
    activeHalos.length = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  // Cleanup
  const destroy = () => {
    reset();
    window.removeEventListener('resize', handleResize);
    if (canvas.parentElement) {
      canvas.parentElement.removeChild(canvas);
    }
  };

  // Resize handler
  const handleResize = () => {
    canvas.width = globeCanvas.offsetWidth;
    canvas.height = globeCanvas.offsetHeight;
  };

  window.addEventListener('resize', handleResize);

  log.debug('[halo] canvas overlay initialized', cfg);

  return {
    showHalo,
    showHaloForCountry,
    reset,
    destroy
  };
};

export { createHaloManager };

