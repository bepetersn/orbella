// Shared pure map math helpers.

export const lonLatTo3D = (lon, lat) => {
  const radLat = (lat * Math.PI) / 180;
  const radLon = (lon * Math.PI) / 180;

  return {
    x: Math.cos(radLat) * Math.cos(radLon),
    y: Math.sin(radLat),
    z: Math.cos(radLat) * Math.sin(radLon),
  };
};

export const safeId = (str) => {
  const s = String(str ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'id';
};

export const getCountryKey = (feature) =>
  String(feature?.properties?.name || feature?.properties?.NAME_EN || '')
    .trim()
    .toLowerCase();

export const isCountryInContinent = (country, continentName) => {
  if (!continentName) return true;
  const memberships = country?.properties?.continents;
  if (Array.isArray(memberships) && memberships.length > 0) {
    return memberships.includes(continentName);
  }
  return country?.properties?.continent === continentName;
};

export const normalizeCountryFeature = (ctx, feature) => {
  if (!feature || !feature.properties) return feature;

  const p = { ...feature.properties };
  // canonical name
  p.name = p.name || p.NAME_EN || p.ADMIN || p.NAME || p.displayName || '';
  p.displayName = p.displayName || p.name;
  // provide simple continent normalization
  p.continent = p.continent || p.CONTINENT || p.CONTINENT_NAME || p.region || null;

  return { ...feature, properties: p };
};

export const isPlayableCountry = (feature) => {
  if (!feature || !feature.properties) return false;
  if (feature.properties.EXCLUDED) return false;
  if (!feature.geometry) return false;
  const name = String(feature.properties.name || feature.properties.displayName || '').trim();
  return !!name;
};

export const getRenderableFeature = (ctx, countryOrName) => {
  if (!ctx) return countryOrName;
  const map = ctx.renderFeatureByName;
  if (!map) return countryOrName;
  if (!countryOrName) return null;

  // If passed a feature, lookup by its key; if passed a string, use as key.
  const key =
    typeof countryOrName === 'string'
      ? countryOrName.trim().toLowerCase()
      : getCountryKey(countryOrName);
  return map.get(key) || countryOrName;
};

export const getSvgDimensions = (ctx) => {
  try {
    const svgNode = ctx?.svg?.node && ctx.svg.node();
    if (svgNode && typeof svgNode.getBoundingClientRect === 'function') {
      const rect = svgNode.getBoundingClientRect();
      return { actualWidth: rect.width, actualHeight: rect.height };
    }
  } catch (e) {
    /* ignore */
  }
  return { actualWidth: Number(ctx?.width) || 0, actualHeight: Number(ctx?.height) || 0 };
};

// Centroid helpers used across map modules. Exported to avoid duplicate
// implementations in `globe.js` and `globe-halo.js`.
export const centroidFromProperties = (properties, isMultiPolygon) => {
  if (isMultiPolygon || !properties) return null;

  if (Array.isArray(properties.geometryCenter) && properties.geometryCenter.length >= 2) {
    return {
      lat: properties.geometryCenter[1],
      lng: properties.geometryCenter[0],
    };
  }

  if (Array.isArray(properties.geometryBounds) && properties.geometryBounds.length >= 4) {
    const [minLon, minLat, maxLon, maxLat] = properties.geometryBounds;
    return { lat: (minLat + maxLat) / 2, lng: (minLon + maxLon) / 2 };
  }

  return null;
};

export const firstGeometryRing = (geometry) => {
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates?.[0]?.[0] || null;
  if (geometry?.type === 'Polygon') return geometry.coordinates?.[0] || null;
  return null;
};

export const largestGeometryRing = (geometry) => {
  if (geometry?.type === 'Polygon') return geometry.coordinates?.[0] || null;
  if (geometry?.type !== 'MultiPolygon') return null;

  let best = null;
  let bestLen = -1;
  for (const poly of geometry.coordinates) {
    const ring = poly[0];
    if (Array.isArray(ring) && ring.length > bestLen) {
      best = ring;
      bestLen = ring.length;
    }
  }
  return best;
};

export const centroidFromRing = (ring) => {
  if (!Array.isArray(ring) || !ring.length) return null;

  let sumLon = 0;
  let sumLat = 0;
  let count = 0;

  for (const pt of ring) {
    if (Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1])) {
      sumLon += pt[0];
      sumLat += pt[1];
      count += 1;
    }
  }

  if (count === 0) return null;
  return { lat: sumLat / count, lng: sumLon / count };
};

export const resolveCentroid = (country) => {
  if (!country) return null;
  try {
    const isMulti = country?.geometry?.type === 'MultiPolygon';
    const propertyCentroid = centroidFromProperties(country?.properties, isMulti);
    if (propertyCentroid) return propertyCentroid;

    // Prefer largest ring centroid for better visual placement on complex features
    const ring = largestGeometryRing(country?.geometry) || firstGeometryRing(country?.geometry);
    return centroidFromRing(ring);
  } catch (e) {
    return null;
  }
};
