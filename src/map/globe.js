// Lightweight Globe.gl initializer — deliberately simple and maintainable.
// Responsibility: render a globe into #globeViz using provided GeoJSON.
// Bootstrap loads the GeoJSON and calls `createWorldleGlobe(geojson)`.

// Top-level helpers pulled out of the `createWorldleGlobe` closure so they
// can be inspected and tested independently. They accept explicit
// parameters (including logger functions) instead of relying on closure
// variables.
// Configuration constants (extracted for clarity and easy tuning)
const DEFAULT_DESIRED_CAMERA_DISTANCE = 1.3;
const HIDE_ANTARCTICA_DEFAULT = true;
const ALTITUDE_CONTROL = {
  MIN: 0.3,
  MAX: 10,
  STEP: 0.05,
  SLIDER_WIDTH: '160px',
  LABEL_MIN_WIDTH: '36px'
};
const DEBUG_PANEL_MIN_WIDTH = '220px';
const LARGE_COORD_EXTREME = 1000; // used to flag extreme vertex coordinates
const LARGE_MESH_RADIUS_THRESHOLD = 1000; // radius above which a mesh is considered "large"


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

const normalizeGlobeMeshTop = (globe, { info = () => {}, warn = () => {} } = {}) => {
  try {
    const scene = globe.scene && globe.scene();
    if (!scene || !scene.children) return info('normalizeGlobeMesh: no scene available');
    let largest = null;
    for (let i = 0; i < scene.children.length; ++i) {
      const c = scene.children[i];
      try {
        if (c && c.geometry) {
          if (!c.geometry.boundingSphere && typeof c.geometry.computeBoundingSphere === 'function') c.geometry.computeBoundingSphere();
          const r = c.geometry.boundingSphere && c.geometry.boundingSphere.radius ? c.geometry.boundingSphere.radius * (c.scale?.x || 1) : 0;
          if (!largest || r > largest.radius) largest = { idx: i, radius: r, node: c };
        }
      } catch (e) { /* ignore per-child errors */ }
    }
    if (!largest || !largest.radius) return info('normalizeGlobeMesh: no sizable mesh found');
    info('normalizeGlobeMesh: found largest mesh (normalization skipped)', { meshIdx: largest.idx, meshRadius: largest.radius });
  } catch (e) { warn('normalizeGlobeMesh inspection failed', e); }
};

const dumpAllGeometriesTop = (globe, { info = () => {}, warn = () => {} } = {}) => {
  try {
    const scene = globe.scene && globe.scene();
    if (!scene || !scene.children) return info('dumpAllGeometries: no scene available');
    const results = [];
    for (let idx = 0; idx < scene.children.length; ++idx) {
      const c = scene.children[idx];
      const item = { idx, type: c.type, name: c.name || null, visible: c.visible, scaleX: c.scale?.x || 1 };
      try {
        if (c.geometry) {
          item.attributes = Object.keys(c.geometry.attributes || {});
          const posAttr = c.geometry.attributes && c.geometry.attributes.position;
          if (posAttr && posAttr.array) {
            const pos = posAttr.array;
            const verts = Math.floor(pos.length / 3);
            item.verts = verts;
            let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
            let extremeCount = 0;
            const samples = [];
            const step = Math.max(1, Math.floor(verts / 40));
            for (let i = 0, vi = 0; vi < verts; ++vi, i += 3) {
              const x = Number(pos[i]), y = Number(pos[i + 1]), z = Number(pos[i + 2]);
              if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
              minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
              maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
                      if (Math.abs(x) > LARGE_COORD_EXTREME || Math.abs(y) > LARGE_COORD_EXTREME || Math.abs(z) > LARGE_COORD_EXTREME) extremeCount++;
              if (vi % step === 0 && samples.length < 40) samples.push({ x: Number(x.toFixed(3)), y: Number(y.toFixed(3)), z: Number(z.toFixed(3)) });
            }
            item.bounds = { minX, minY, minZ, maxX, maxY, maxZ };
            item.extremeCount = extremeCount;
            item.samples = samples;
            if (c.geometry.index) item.indexCount = c.geometry.index.array ? c.geometry.index.array.length : (c.geometry.index.count || null);
          } else {
            item.verts = 0;
          }
        }
      } catch (ge) { item.geometryError = String(ge); }
      try {
        if (c.material) {
          const mat = {};
          if (typeof c.material.type === 'string') mat.type = c.material.type;
          if (c.material.color && typeof c.material.color.getHexString === 'function') mat.color = c.material.color.getHexString();
          if (c.material.uniforms) mat.uniforms = Object.keys(c.material.uniforms);
          item.material = mat;
        }
      } catch (me) { item.materialError = String(me); }
      results.push(item);
    }
    info('dumpAllGeometries', results);
    return results;
  } catch (e) { warn('dumpAllGeometries failed', e); }
};

const getPolygonsDataSamplesTop = (globe, countPerFeature = 6, featureLimit = 10, { warn = () => {} } = {}) => {
  try {
    const data = (typeof globe.polygonsData === 'function') ? globe.polygonsData() : null;
    if (!Array.isArray(data)) return [];
    const results = [];
    for (let i = 0; i < Math.min(featureLimit, data.length); ++i) {
      const f = data[i];
      const name = f?.properties?.name || f?.properties?.NAME || f?.properties?.ADMIN || f.id || `#${i}`;
      const samples = sampleCoordsFromGeometry(f.geometry || f, countPerFeature);
      const stats = { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
      for (const [lon, lat] of samples) {
        if (Number.isFinite(lon) && Number.isFinite(lat)) {
          stats.minLon = Math.min(stats.minLon, lon);
          stats.maxLon = Math.max(stats.maxLon, lon);
          stats.minLat = Math.min(stats.minLat, lat);
          stats.maxLat = Math.max(stats.maxLat, lat);
        }
      }
      results.push({ idx: i, name, samples, stats });
    }
    return results;
  } catch (e) { warn('getPolygonsDataSamplesTop failed', e); return []; }
};

const logPolygonsDataSamplesTop = (globe, countPerFeature = 6, featureLimit = 10, { info = () => {}, warn = () => {} } = {}) => {
  try {
    const s = getPolygonsDataSamplesTop(globe, countPerFeature, featureLimit, { warn });
    info('polygonsDataSamples', s);
    return s;
  } catch (e) { warn('logPolygonsDataSamplesTop failed', e); }
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

// Top-level: dump scene stats (extracted from createWorldleGlobe)
const dumpSceneStatsTop = (globe, features = [], { info = () => {}, warn = () => {} } = {}) => {
  try {
    const scene = globe.scene && globe.scene();
    if (!scene || !scene.children) return info('dumpSceneStats: no scene available');
    const items = scene.children.map((c, idx) => {
      let radius = null;
      try {
        if (c.geometry) {
          if (!c.geometry.boundingSphere && typeof c.geometry.computeBoundingSphere === 'function') c.geometry.computeBoundingSphere();
          radius = c.geometry.boundingSphere && c.geometry.boundingSphere.radius;
        }
      } catch (e) { /* ignore */ }
      const scaleX = c.scale && c.scale.x ? c.scale.x : 1;
      return { idx, type: c.type, name: c.name || null, radius: radius ? Number(radius * scaleX).toFixed(2) : null, scaleX, visible: c.visible };
    });
    info('dumpSceneStats', items);
    const big = items.filter(i => i.radius && Number(i.radius) > 1000);
    if (big.length) info('dumpSceneStats: large items', big);

    if (big.length) {
      const bigIdx = big[0].idx;
      try {
        const mesh = scene.children[bigIdx];
        if (mesh && mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.position) {
          const pos = mesh.geometry.attributes.position.array;
          const verts = pos.length / 3;
          let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
          for (let i = 0; i < pos.length; i += 3) {
            const x = pos[i], y = pos[i+1], z = pos[i+2];
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
            minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
          }
          info('largeMesh.geometry', { idx: bigIdx, verts, minX, minY, minZ, maxX, maxY, maxZ });

          const samples = [];
          const R = Math.max(Math.abs(minX), Math.abs(minY), Math.abs(minZ), Math.abs(maxX), Math.abs(maxY), Math.abs(maxZ));
          for (let i = 0; i < Math.min(60, pos.length); i += 3) {
            const x = pos[i], y = pos[i+1], z = pos[i+2];
            const r = Math.hypot(x, y, z) || R || 1;
            const lat = Math.asin(y / r) * 180 / Math.PI;
            const lon = Math.atan2(z, x) * 180 / Math.PI;
            samples.push({ x: Number(x.toFixed(3)), y: Number(y.toFixed(3)), z: Number(z.toFixed(3)), lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) });
          }
          info('largeMesh.sampleVerts', samples.slice(0,20));

          try {
            const featuresData = features || [];
            const touching = [];
            function lonLatToXYZ(lon, lat, r) {
              const radLat = lat * Math.PI / 180;
              const radLon = lon * Math.PI / 180;
              const x = r * Math.cos(radLat) * Math.cos(radLon);
              const y = r * Math.sin(radLat);
              const z = r * Math.cos(radLat) * Math.sin(radLon);
              return { x, y, z };
            }
            const R2 = Math.max(Math.abs(minX), Math.abs(minY), Math.abs(minZ), Math.abs(maxX), Math.abs(maxY), Math.abs(maxZ));
            for (let fi = 0; fi < featuresData.length; ++fi) {
              const f = featuresData[fi];
              if (!f || !f.geometry) continue;
              let found = false;
              function scanGeo(obj) {
                if (found) return;
                if (Array.isArray(obj)) {
                  if (obj.length >= 2 && typeof obj[0] === 'number' && typeof obj[1] === 'number') {
                    const lon = obj[0], lat = obj[1];
                    const p = lonLatToXYZ(lon, lat, R2);
                    if (Math.abs(Math.abs(p.x) - R2) < 1e-6 || Math.abs(Math.abs(p.y) - R2) < 1e-6 || Math.abs(Math.abs(p.z) - R2) < 1e-6) {
                      found = true;
                    }
                  } else {
                    for (const it of obj) scanGeo(it);
                  }
                } else if (obj && typeof obj === 'object') {
                  for (const k of Object.keys(obj)) scanGeo(obj[k]);
                }
              }
              scanGeo(f.geometry);
              if (found) {
                touching.push({ idx: fi, name: (f.properties && (f.properties.name || f.properties.admin)) || f.id || `#${fi}` });
              }
            }
            info('largeMesh.touchingFeatures', touching.slice(0, 20));
          } catch (e) { warn('feature-mapping failed', e); }
        } else {
          info('largeMesh: no geometry.position available for detailed inspection');
        }
      } catch (e) { warn('inspect large mesh failed', e); }
      try {
        info('dumpSceneStats: large mesh detected (no auto camera fix applied)', { largeItems: big });
      } catch (e) { /* ignore logging errors */ }
    }
  } catch (e) { warn('dumpSceneStats failed', e); }
};

// Build DOM elements for altitude controls and attach to container.
const buildAltitudeControlsElementTop = ({ appendTo = null, initialValue = 1.6 } = {}) => {
  const mapControls = appendTo || document.getElementById('map-controls');
  if (!mapControls) return null;
  const wrapper = document.createElement('div');
  wrapper.id = 'globe-alt-controls';
  wrapper.style.display = 'inline-flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.gap = '8px';
  const btnDec = document.createElement('button'); btnDec.type = 'button'; btnDec.id = 'btn-alt-decrease'; btnDec.className = 'small-btn'; btnDec.textContent = '-';
  const slider = document.createElement('input'); slider.type = 'range'; slider.id = 'altitude-slider'; slider.min = String(ALTITUDE_CONTROL.MIN); slider.max = String(ALTITUDE_CONTROL.MAX); slider.step = String(ALTITUDE_CONTROL.STEP); slider.value = String(initialValue); slider.style.width = ALTITUDE_CONTROL.SLIDER_WIDTH;
  const btnInc = document.createElement('button'); btnInc.type = 'button'; btnInc.id = 'btn-alt-increase'; btnInc.className = 'small-btn'; btnInc.textContent = '+';
  const label = document.createElement('span'); label.id = 'altitude-value'; label.textContent = slider.value; label.style.minWidth = ALTITUDE_CONTROL.LABEL_MIN_WIDTH;
  wrapper.appendChild(btnDec); wrapper.appendChild(slider); wrapper.appendChild(btnInc); wrapper.appendChild(label); mapControls.appendChild(wrapper);
  return { wrapper, btnDec, btnInc, slider, label };
};

// Wire behavior for altitude controls (events, syncing) and return API.
const wireAltitudeControlsTop = (globe, elements, initialView = { lat:0, lng:0, altitude:1.6 }) => {
  if (!elements) return null;
  const { wrapper, btnDec, btnInc, slider, label } = elements;
  let changeInterval = null; let holdTimeout = null; const step = parseFloat(slider.step) || 0.1;
  function getCurrentPov() { try { const p = (typeof globe.pointOfView === 'function') ? globe.pointOfView() : null; return p || initialView; } catch (e) { return initialView; } }
  function setAltitude(alt, animate = 300) { const pov = getCurrentPov(); const lat = (pov && typeof pov.lat === 'number') ? pov.lat : initialView.lat; const lng = (pov && typeof pov.lng === 'number') ? pov.lng : initialView.lng; try { globe.pointOfView({ lat, lng, altitude: Number(alt) }, animate); } catch (e) { } slider.value = String(alt); label.textContent = String(Number(alt).toFixed(2)); }
  slider.addEventListener('input', (e) => { setAltitude(e.target.value, 0); });
  slider.addEventListener('change', (e) => { setAltitude(e.target.value, 250); });
  setTimeout(() => { try { const pov = (typeof globe.pointOfView === 'function') ? globe.pointOfView() : null; if (pov && typeof pov.altitude === 'number') { slider.value = String(pov.altitude); label.textContent = String(Number(pov.altitude).toFixed(2)); } } catch (e) { } }, 350);
  function startAdjustInterval(delta) { if (changeInterval) return; changeInterval = setInterval(() => { const next = Math.max(Number(slider.min), Math.min(Number(slider.max), Number(slider.value) + delta)); setAltitude(next, 120); }, 120); }
  function stopAdjust() { if (changeInterval) { clearInterval(changeInterval); changeInterval = null; } if (holdTimeout) { clearTimeout(holdTimeout); holdTimeout = null; } }
  function onPointerDown(delta, ev) { try { ev.preventDefault(); } catch (e) { } const next = Math.max(Number(slider.min), Math.min(Number(slider.max), Number(slider.value) + delta)); setAltitude(next, 200); holdTimeout = setTimeout(() => startAdjustInterval(delta), 350); }
  btnInc.addEventListener('pointerdown', onPointerDown.bind(null, step)); btnDec.addEventListener('pointerdown', onPointerDown.bind(null, -step)); document.addEventListener('pointerup', stopAdjust); btnInc.addEventListener('pointercancel', stopAdjust); btnDec.addEventListener('pointercancel', stopAdjust); btnInc.addEventListener('pointerleave', stopAdjust); btnDec.addEventListener('pointerleave', stopAdjust);
  const runtimeInst = window.worldleLiteRuntime?.worldMapInst;
  if (runtimeInst && typeof runtimeInst.zoomToCountry === 'function') {
    const orig = runtimeInst.zoomToCountry;
    runtimeInst.zoomToCountry = function (country) { try { orig(country); } catch (e) { } setTimeout(() => { try { const pov = (typeof globe.pointOfView === 'function') ? globe.pointOfView() : null; if (pov && typeof pov.altitude === 'number') { slider.value = String(pov.altitude); label.textContent = String(Number(pov.altitude).toFixed(2)); } } catch (e) { } }, 350); };
  }
  return { element: wrapper, setAltitude, stopAdjust };
};

// Top-level: factory for altitude controls (extracted from createWorldleGlobe)
const createAltitudeControlsTop = (globe, initialView = { lat:0, lng:0, altitude:1.6 }, DESIRED_CAMERA_DISTANCE = 1.6, { appendTo = null, info = () => {}, warn = () => {} } = {}) => {
  try {
    const el = buildAltitudeControlsElementTop({ appendTo, initialValue: initialView.altitude || DESIRED_CAMERA_DISTANCE || 1.6 });
    if (!el) return null;
    return wireAltitudeControlsTop(globe, el, initialView);
  } catch (e) { warn('createAltitudeControlsTop failed', e); return null; }
};

// Top-level: create a minimal runtime stub expected by the app.
// Extracted from `createWorldleGlobe` so it can be tested and kept small.
const createRuntimeStubTop = (features = [], globe, { log = () => {}, info = () => {}, warn = () => {} } = {}) => {
  try {
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
              // clear previous targets
              for (const f of data) {
                try { if (f && f.properties) f.properties._target = false; } catch (e) { /* ignore */ }
              }
              // find match by normalized name
              const name = String(country?.properties?.name || country?.properties?.displayName || country || '').trim().toLowerCase();
              const target = data.find((f) => String(f?.properties?.name || f?.properties?.displayName || '').trim().toLowerCase() === name);
              if (target) {
                try { target.properties._target = true; } catch (e) { /* ignore */ }
                try { globe.polygonsData(data); } catch (e) { /* ignore */ }
              }
            }
            // attempt to center camera on feature centroid/bounds
            const p = country && country.properties;
            let centroid = null;
            if (p && Array.isArray(p.geometryCenter) && p.geometryCenter.length >= 2) {
              centroid = { lat: p.geometryCenter[1], lng: p.geometryCenter[0] };
            } else if (p && Array.isArray(p.geometryBounds) && p.geometryBounds.length >= 4) {
              const [minLon, minLat, maxLon, maxLat] = p.geometryBounds;
              centroid = { lat: (minLat + maxLat) / 2, lng: (minLon + maxLon) / 2 };
            } else if (country && country.geometry) {
              // crude centroid: average of first polygon coordinates
              try {
                const parts = country.geometry.type === 'MultiPolygon' ? country.geometry.coordinates[0][0] : (country.geometry.type === 'Polygon' ? country.geometry.coordinates[0] : null);
                if (Array.isArray(parts) && parts.length) {
                  let sumLon = 0, sumLat = 0, count = 0;
                  for (const pt of parts) {
                    if (Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1])) {
                      sumLon += pt[0]; sumLat += pt[1]; count += 1;
                    }
                  }
                  if (count > 0) centroid = { lat: sumLat / count, lng: sumLon / count };
                }
              } catch (e) { /* ignore */ }
            }
            if (centroid) {
              try { globe.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: 1.8 }, 600); } catch (e) { /* ignore */ }
            }
          } catch (e) { warn('stub.markTarget failed', e); }
        },
        zoomToCountry: (country) => {
        try {
          const p = country && country.properties;
          let centroid = null;
          if (p && Array.isArray(p.geometryCenter) && p.geometryCenter.length >= 2) {
            centroid = { lat: p.geometryCenter[1], lng: p.geometryCenter[0] };
          } else if (p && Array.isArray(p.geometryBounds) && p.geometryBounds.length >= 4) {
            const [minLon, minLat, maxLon, maxLat] = p.geometryBounds;
            centroid = { lat: (minLat + maxLat) / 2, lng: (minLon + maxLon) / 2 };
          } else if (country && country.geometry) {
            try {
              const parts = country.geometry.type === 'MultiPolygon' ? country.geometry.coordinates[0][0] : (country.geometry.type === 'Polygon' ? country.geometry.coordinates[0] : null);
              if (Array.isArray(parts) && parts.length) {
                let sumLon = 0, sumLat = 0, count = 0;
                for (const pt of parts) {
                  if (Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1])) {
                    sumLon += pt[0]; sumLat += pt[1]; count += 1;
                  }
                }
                if (count > 0) centroid = { lat: sumLat / count, lng: sumLon / count };
              }
            } catch (e) { /* ignore */ }
          }
          if (centroid) globe.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: 1.8 }, 600);
        } catch (e) { /* ignore */ }
      },
      showLocationHalo: () => {},
      setRegionFilter: () => {},
      markSolved: (country) => {
        try {
          const data = (typeof globe.polygonsData === 'function') ? globe.polygonsData() : null;
          if (Array.isArray(data)) {
            const name = String(country?.properties?.name || country?.properties?.displayName || country || '').trim().toLowerCase();
            for (const f of data) {
              try {
                const fname = String(f?.properties?.name || f?.properties?.displayName || '').trim().toLowerCase();
                if (fname === name) {
                  if (f && f.properties) {
                    f.properties._target = false;
                    f.properties._solved = true;
                    f.properties._wrong = false;
                  }
                }
              } catch (e) { /* ignore */ }
            }
            try { globe.polygonsData(data); } catch (e) { /* ignore */ }
          }
        } catch (e) { /* ignore */ }
      },
      markWrong: (country) => {
        try {
          const data = (typeof globe.polygonsData === 'function') ? globe.polygonsData() : null;
          if (Array.isArray(data)) {
            const name = String(country?.properties?.name || country?.properties?.displayName || country || '').trim().toLowerCase();
            for (const f of data) {
              try {
                const fname = String(f?.properties?.name || f?.properties?.displayName || '').trim().toLowerCase();
                if (fname === name) {
                  if (f && f.properties) {
                    f.properties._target = false;
                    f.properties._wrong = true;
                    f.properties._solved = false;
                  }
                }
              } catch (e) { /* ignore */ }
            }
            try { globe.polygonsData(data); } catch (e) { /* ignore */ }
          }
        } catch (e) { /* ignore */ }
      },
      loadCountries: () => Promise.resolve({ countriesData: features, countryNames: features.map(f => f.properties?.name).filter(Boolean).sort(), countryByName: new Map(features.map(f => [String(f.properties?.name || '').toLowerCase(), f])) })
    };

    const toggleAntarcticaDisplay = function (show) {
      try {
        const shouldShow = (typeof show === 'boolean') ? show : true;
        const newList = shouldShow ? features.filter(f => !(f?.properties?.EXCLUDED)) : features.filter(f => { const name = f?.properties?.name || f?.properties?.NAME || f?.properties?.ADMIN; return String(name).toLowerCase() !== 'antarctica' && !(f?.properties?.EXCLUDED); });
        globe.polygonsData(newList);
        info('toggleAntarcticaDisplay', { show: shouldShow, renderCount: newList.length });
      } catch (e) { warn('toggleAntarcticaDisplay failed', e); }
    };

    return { stub, toggleAntarcticaDisplay };
  } catch (e) { warn('createRuntimeStubTop failed', e); return { stub: null, toggleAntarcticaDisplay: () => {} }; }
};

// Top-level: create a Globe instance with standard polygon accessors.
const createGlobeInstanceTop = (container, globeImg, renderFeatures, initialFlip, polygonsDataProvider) => {
  const polygonsData = (typeof polygonsDataProvider === 'function')
    ? polygonsDataProvider(initialFlip)
    : (typeof buildProcessedFeaturesTop === 'function' ? buildProcessedFeaturesTop(renderFeatures, initialFlip) : renderFeatures);

  const globe = new Globe(container)
    .globeImageUrl(globeImg)
    .globeOffset([0, 0])
    .polygonsData(polygonsData)
    .polygonGeoJsonGeometry('geometry')
    .polygonAltitude(() => 0.02)
    .polygonCapColor((d) => {
      try {
        if (d && d.properties) {
          if (d.properties._solved) return getComputedStyle(document.documentElement).getPropertyValue('--correct-fill') || '#58b48a';
          if (d.properties._wrong) return getComputedStyle(document.documentElement).getPropertyValue('--wrong-persist') || '#f3b5c1';
          if (d.properties._target) return getComputedStyle(document.documentElement).getPropertyValue('--halo-color') || '#f2c95c';
        }
      } catch (e) { /* ignore */ }
      return getComputedStyle(document.documentElement).getPropertyValue('--country-fill') || '#c5d2e1';
    })
    .polygonSideColor(() => 'rgba(0,0,0,0)')
    .polygonStrokeColor((d) => {
      try {
        if (d && d.properties && d.properties._wrong) return getComputedStyle(document.documentElement).getPropertyValue('--wrong-persist-str') || 'rgba(217,77,103,0.9)';
      } catch (e) { /* ignore */ }
      return getComputedStyle(document.documentElement).getPropertyValue('--country-str') || 'rgba(51,65,85,0.98)';
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
    controls.minDistance = Math.max(0.1, globeRadiusAbs * 0.2);
    controls.maxDistance = Math.max(3, globeRadiusAbs * 10);
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI - 0.2;
    if (typeof controls.target?.set === 'function') controls.target.set(0, 0, 0);
    if (typeof controls.update === 'function') controls.update();
    info('configureControlsTop applied', { minDistance: controls.minDistance, maxDistance: controls.maxDistance });
  } catch (e) { /* non-fatal */ }
};

window.createWorldleGlobe = function createWorldleGlobe(geojson) {
  
  // Preferred camera distance in globe radii (used by POV fixes).
  // Lower default to bring camera closer by default.
  const DESIRED_CAMERA_DISTANCE = 1.3;
  
  if (typeof Globe === 'undefined') {
    (window.worldleLiteLogger?.warn || console.warn)('Globe.gl not available; skipping globe initialization');
    return null;
  }

  const container = document.getElementById('globeViz');
  if (!container) return null;

  const features = Array.isArray(geojson?.features) ? geojson.features : [];
  // Silence all internal logging in production builds — replace with no-ops.
  // If you need logs again, temporarily re-enable or route through
  // `window.worldleLiteLogger` before calling `createWorldleGlobe`.
  const log = () => {};
  const info = () => {};
  const warn = () => {};
  const error = () => {};

  // computeGeoStats delegated to the top-level `computeGeoStats` helper

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

  // Quick image load check (non-blocking). Keep it simple.
  const checkImage = (url) => {
    if (!url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => log('globe image loaded', url, img.naturalWidth, img.naturalHeight);
    img.onerror = (e) => warn('globe image failed to load', url, e && e.type);
    img.src = url;
  };
  checkImage(globeImg);

  // Temporarily filter out Antarctica for rendering to avoid oversized mesh issues.
  // This does not remove the feature from the app state; it's only for the globe layer.
  const SHOULD_HIDE_ANTARCTICA = true; // toggle during debugging; keep true by default for now
  const renderFeatures = Array.isArray(features)
    ? features.filter(f => {
      try {
        const name = f?.properties?.name || f?.properties?.NAME || f?.properties?.ADMIN;
        const excluded = f?.properties?.EXCLUDED;
        if (SHOULD_HIDE_ANTARCTICA && String(name).toLowerCase() === 'antarctica') return false;
        if (excluded) return false;
        return true;
      } catch (e) { return true; }
    })
    : [];

  info('globe: rendering features', { total: features.length, renderCount: renderFeatures.length, hiddenAntarctica: features.length - renderFeatures.length });

  // Helper: produce the features passed to Globe.gl, optionally flipping
  // longitudes when `flipped` is truthy. This avoids relying on a
  // missing external `buildProcessedFeaturesTop` implementation.
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
        const out = Array.isArray(obj) ? [] : {};
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
  const initialView = { lat: 0, lng: 0, altitude: DESIRED_CAMERA_DISTANCE };
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

  // Dump scene children stats to help find oversized meshes (useful when
  // debug overlay shows an unexpectedly large mesh radius).
  try {
    const dumpSceneStats = () => dumpSceneStatsTop(globe, features, { info, warn });
    const normalizeGlobeMesh = () => normalizeGlobeMeshTop(globe, { info, warn });

    if (typeof globe.onGlobeReady === 'function') {
      globe.onGlobeReady(() => {
        setTimeout(dumpSceneStats, 350);
        // schedule a follow-up normalization in case the quick camera fix was overridden later
        setTimeout(() => { try { normalizeGlobeMesh(); } catch (e) { /* ignore */ } }, 650);
      });
    } else {
      setTimeout(dumpSceneStats, 350);
      setTimeout(() => { try { normalizeGlobeMesh(); } catch (e) { /* ignore */ } }, 650);
    }
  } catch (e) { /* non-fatal */ }

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

  // Diagnostics: polygon sampling delegated to top-level helpers
  try {
    // wrappers created later map to the top-level implementations
  } catch (e) { /* ignore */ }

  // Deep geometry dumper for debugging: inspects every scene child and
  // collects geometry attribute ranges, sample verts and material info.
  // Exposed as `window.dumpGlobeGeometries()` for manual invocation.
  try {
    const dumpAllGeometries = (opts = {}) => dumpAllGeometriesTop(globe, { info, warn });
    // make it easy to call immediately as well (not exposed globally)
    // helpers available via closure: dumpAllGeometries
  } catch (e) { /* non-fatal */ }

  // Configure orbit controls using top-level helper
  try { configureControlsTop(globe, { info }); } catch (e) { /* non-fatal */ }

  // Auto-normalize globe mesh scale if geometry is unexpectedly large.
  // This helps make camera altitude controls behave predictably when the
  // provided GeoJSON or generated geometry uses a very large radius.
  try {
    // (removed) normalization logic kept out of runtime
  } catch (e) { /* ignore */ }

  // Live debug overlay: use top-level creator to avoid closure bloat
  try {
    const dbgPanel = createDebugPanelTop(globe);
    // debug panel created but not exposed globally in production builds
  } catch (e) { /* non-fatal */ }

  // Minimal runtime bridge expected by rest of app
  try {
    const runtime = window.worldleLiteRuntime || {};
    const { stub, toggleAntarcticaDisplay } = createRuntimeStubTop(features, globe, { log, info, warn });
    runtime.worldMapInst = stub;
    // expose globe instance so other modules (and dev UI) can control POV
    runtime.globe = globe;
    window.worldleLiteRuntime = runtime;
    // expose a toggle helper for runtime testing
    window.toggleAntarcticaDisplay = toggleAntarcticaDisplay;
  } catch (e) { /* ignore */ }

  // Wire polygon click to runtime markTarget for convenient debugging
  try {
    globe.onPolygonClick((d) => {
      if (!d) return;
      try { window.worldleLiteRuntime.worldMapInst.markTarget(d); } catch (e) { /* ignore */ }
    });
  } catch (e) { /* ignore */ }

  // Altitude UI: use top-level factory to avoid closure bloat
  try {
    createAltitudeControlsTop(globe, initialView, DESIRED_CAMERA_DISTANCE, { appendTo: document.getElementById('map-controls'), info, warn });
  } catch (e) { /* non-fatal */ }

  return globe;
};
