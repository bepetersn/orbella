const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'data', 'generated', 'world-countries.render.json');
const data = JSON.parse(fs.readFileSync(p, 'utf8'));
let maxAbs = 0;
let totalCoords = 0;
let offenders = [];
function scanCoords(obj, featureIdx) {
  if (Array.isArray(obj)) {
    if (obj.length >= 2 && typeof obj[0] === 'number' && typeof obj[1] === 'number') {
      const lon = obj[0];
      const lat = obj[1];
      totalCoords++;
      maxAbs = Math.max(maxAbs, Math.abs(lon), Math.abs(lat));
      const bad = Math.abs(lon) > 1000 || Math.abs(lat) > 1000 || lon < -180 || lon > 180 || lat < -90 || lat > 90;
      if (bad) {
        offenders.push({ featureIdx, lon, lat });
      }
    } else {
      for (const item of obj) scanCoords(item, featureIdx);
    }
  } else if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) scanCoords(obj[k], featureIdx);
  }
}
if (!data.features) {
  console.error('No features in JSON');
  process.exit(2);
}
data.features.forEach((f, i) => {
  scanCoords(f.geometry, i);
});
console.log('file:', p);
console.log('features:', data.features.length);
console.log('total coords scanned:', totalCoords);
console.log('max absolute coordinate value:', maxAbs);
console.log('offending coords count:', offenders.length);
if (offenders.length > 0) {
  const byFeature = new Map();
  for (const o of offenders) {
    const key = o.featureIdx;
    byFeature.set(key, (byFeature.get(key) || 0) + 1);
  }
  console.log('\nFeatures with offenders (up to 50):');
  let shown = 0;
  for (const [idx, count] of byFeature.entries()) {
    if (shown++ > 50) break;
    const f = data.features[idx];
    const name = (f.properties && (f.properties.name || f.properties.NAME || f.properties.admin)) || f.id || `#${idx}`;
    console.log(idx, 'name:', name, 'offending coords:', count);
  }
  console.log('\nSample offenders (up to 20):');
  offenders.slice(0,20).forEach(o => console.log(o));
} else {
  console.log('No offending coordinates found.');
}
