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
