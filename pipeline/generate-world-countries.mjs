import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(scriptDir, 'data', 'world-countries.json');
const outputPath = path.join(scriptDir, 'data', 'generated', 'world-countries.render.json');

const isoCodeOverrides = new Map([
  ['czech republic', 'CZ'],
  ['democratic republic of the congo', 'CD'],
  ['east timor', 'TL'],
  ['ivory coast', 'CI'],
  ['myanmar', 'MM'],
  ['palestine', 'PS'],
  ['people s republic of china', 'CN'],
  ['republic of the congo', 'CG'],
  ['saint kitts and nevis', 'KN'],
  ['saint lucia', 'LC'],
  ['saint vincent and the grenadines', 'VC'],
  ['the bahamas', 'BS'],
  ['the gambia', 'GM'],
  ['turkey', 'TR'],
  ['united states of america', 'US'],
  ['benin', 'BJ'],
  ['burkina faso', 'BF'],
  ['france', 'FR'],
  ['germany', 'DE'],
  ['russia', 'RU'],
  ['serbia', 'RS'],
  ['united kingdom', 'GB'],
  ['vanuatu', 'VU'],
  ['vietnam', 'VN'],
  ['yemen', 'YE'],
  ['zimbabwe', 'ZW']
]);

const displayNames = typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;

const regionLookup = new Map();

function normalizeLookupName(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/&/gu, ' and ')
    .replace(/[’'`´]/gu, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function buildRegionLookup() {
  if (regionLookup.size || !displayNames) {
    return regionLookup;
  }

  for (let first = 65; first <= 90; first += 1) {
    for (let second = 65; second <= 90; second += 1) {
      const code = String.fromCharCode(first, second);
      const label = displayNames.of(code);

      if (!label) {
        continue;
      }

      const normalizedLabel = normalizeLookupName(label);
      const existing = regionLookup.get(normalizedLabel) || [];
      regionLookup.set(normalizedLabel, [...existing, code]);
    }
  }

  return regionLookup;
}

function resolveIsoCode(countryName) {
  const normalizedName = normalizeLookupName(countryName);

  if (!normalizedName) {
    return null;
  }

  const override = isoCodeOverrides.get(normalizedName);
  if (override) {
    return override;
  }

  const matches = buildRegionLookup().get(normalizedName) || [];
  return matches.length === 1 ? matches[0] : null;
}

function flagEmojiFromCountryCode(countryCode) {
  const alpha2Code = String(countryCode ?? '').trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(alpha2Code)) {
    return null;
  }

  const firstRegionalIndicator = 0x1f1e6 + (alpha2Code.charCodeAt(0) - 65);
  const secondRegionalIndicator = 0x1f1e6 + (alpha2Code.charCodeAt(1) - 65);
  return String.fromCodePoint(firstRegionalIndicator, secondRegionalIndicator);
}

function collectAliases(properties) {
  const aliases = properties?.NAME_ALIASES;

  if (!Array.isArray(aliases)) {
    return [];
  }

  return [...new Set(
    aliases
      .filter((aliasName) => typeof aliasName === 'string')
      .map((aliasName) => aliasName.trim())
      .filter(Boolean)
  )];
}

function collectContinents(properties) {
  const continents = [];
  const sourceContinent = properties?.CONTINENT ?? properties?.continent;

  if (sourceContinent) {
    continents.push(sourceContinent);
  }

  if (Array.isArray(properties?.continents)) {
    continents.push(...properties.continents.filter(Boolean));
  }

  return [...new Set(continents)];
}

function visitCoordinates(value, visitor) {
  if (!Array.isArray(value)) {
    return;
  }

  if (value.length === 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])) {
    visitor(value);
    return;
  }

  for (const entry of value) {
    visitCoordinates(entry, visitor);
  }
}

function getGeometryStats(geometry) {
  const bounds = {
    minLon: Number.POSITIVE_INFINITY,
    minLat: Number.POSITIVE_INFINITY,
    maxLon: Number.NEGATIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY
  };
  let pointCount = 0;
  let ringCount = 0;
  let sumLon = 0;
  let sumLat = 0;
  let coordCount = 0;

  if (!geometry || !Array.isArray(geometry.coordinates)) {
    return null;
  }

  const registerCoordinate = ([longitude, latitude]) => {
    bounds.minLon = Math.min(bounds.minLon, longitude);
    bounds.minLat = Math.min(bounds.minLat, latitude);
    bounds.maxLon = Math.max(bounds.maxLon, longitude);
    bounds.maxLat = Math.max(bounds.maxLat, latitude);
    sumLon += longitude;
    sumLat += latitude;
    coordCount += 1;
    pointCount += 1;
  };

  const registerRing = (ring) => {
    if (Array.isArray(ring) && ring.length) {
      ringCount += 1;
    }
    visitCoordinates(ring, registerCoordinate);
  };

  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(registerRing);
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((polygon) => polygon.forEach(registerRing));
  } else {
    return null;
  }

  if (!Number.isFinite(bounds.minLon) || !Number.isFinite(bounds.minLat) || !Number.isFinite(bounds.maxLon) || !Number.isFinite(bounds.maxLat)) {
    return null;
  }

  // Compute center, handling antimeridian crossing
  // When a geometry crosses the antimeridian, bounds will show -180 to 180.
  // In this case, compute the mean of actual coordinates, but normalize
  // negative lons to 0-360 range first to get a meaningful average.
  let centerLon;
  let centerLat = (bounds.minLat + bounds.maxLat) / 2;
  
  const lonSpan = bounds.maxLon - bounds.minLon;
  if (bounds.minLon < -179 && bounds.maxLon > 179 && lonSpan > 358) {
    // Antimeridian crossing: compute mean of actual points
    // Normalize all negative lons to 0-360, compute mean, then normalize back if needed
    let normalizedMeanLon = sumLon / coordCount;
    if (normalizedMeanLon < 0) {
      normalizedMeanLon += 360;
    }
    centerLon = normalizedMeanLon > 180 ? normalizedMeanLon - 360 : normalizedMeanLon;
  } else {
    centerLon = (bounds.minLon + bounds.maxLon) / 2;
  }

  return {
    bounds: [bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat],
    center: [centerLon, centerLat],
    pointCount,
    ringCount
  };
}

// Transform coordinates in-place using a transformer function [x,y] -> [x2,y2]
function transformGeometryCoordinates(geometry, transformer) {
  function walk(coords) {
    if (!Array.isArray(coords)) return coords;
    if (coords.length === 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
      return transformer(coords);
    }
    return coords.map(walk);
  }

  if (!geometry || !Array.isArray(geometry.coordinates)) return geometry;

  if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
    geometry.coordinates = walk(geometry.coordinates);
  }

  return geometry;
}

function webMercatorToLonLat([x, y]) {
  // Converts EPSG:3857 (meters) -> [lon, lat]
  const R = 20037508.34; // half Earth circumference in meters used by WebMercator
  const lon = (x / R) * 180;
  let lat = (y / R) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
  return [Number(lon), Number(lat)];
}

function normalizeFeature(feature) {
  const properties = feature?.properties ?? {};
  const displayName = properties.NAME_EN?.trim() || null;

  if (!displayName) {
    return feature;
  }

  const aliases = collectAliases(properties);
  const continents = collectContinents(properties);
  const isoCode = resolveIsoCode(displayName);
  let geometryStats = getGeometryStats(feature.geometry);

  // Detect obviously out-of-range coordinates and attempt a sensible
  // automatic convert from Web Mercator (EPSG:3857) to lon/lat. This
  // prevents generated GeoJSON from containing huge coordinates that
  // later produce an enormous mesh and cause the globe to appear
  // super-zoomed.
  if (geometryStats) {
    const [minLon, minLat, maxLon, maxLat] = geometryStats.bounds;
    const maxAbs = Math.max(Math.abs(minLon), Math.abs(minLat), Math.abs(maxLon), Math.abs(maxLat));
    // If coordinates are far outside typical degree ranges (and likely meters), convert.
    if (maxAbs > 1000) {
      try {
        feature.geometry = transformGeometryCoordinates(feature.geometry, webMercatorToLonLat);
        // recompute stats after transform
        geometryStats = getGeometryStats(feature.geometry);
        console.warn(`generate-world-countries: converted feature ${displayName} from WebMercator to lon/lat`);
      } catch (e) {
        console.warn(`generate-world-countries: failed to convert geometry for ${displayName}`, e && e.message);
      }
    }

    // Attempt to correct common coordinate axis issues before failing:
    // 1) longitudes expressed as 0..360 -> convert to -180..180
    // 2) coordinates swapped (lat,lon) -> swap back to (lon,lat)
    function normalizeLon(v) {
      if (!Number.isFinite(v)) return v;
      while (v > 180) v -= 360;
      while (v < -180) v += 360;
      return v;
    }

    function tryFixBounds() {
      if (!geometryStats) return false;
      const [nLon, nLat, xLon, xLat] = geometryStats.bounds;
      const lonOk = Number.isFinite(nLon) && Number.isFinite(xLon) && Math.abs(nLon) <= 180 && Math.abs(xLon) <= 180;
      const latOk = Number.isFinite(nLat) && Number.isFinite(xLat) && Math.abs(nLat) <= 90 && Math.abs(xLat) <= 90;

      if (lonOk && latOk) return true;

      // Case: longitudes in 0..360 (min >= 0 and max > 180)
      if (Number.isFinite(nLon) && Number.isFinite(xLon) && nLon >= 0 && xLon > 180) {
        try {
          feature.geometry = transformGeometryCoordinates(feature.geometry, ([lon, lat]) => [normalizeLon(lon), lat]);
          geometryStats = getGeometryStats(feature.geometry);
          return Boolean(geometryStats && Math.abs(geometryStats.bounds[0]) <= 180 && Math.abs(geometryStats.bounds[2]) <= 180);
        } catch (e) { /* continue to other heuristics */ }
      }

      // Case: coordinates swapped (lat/lon) — heuristics: lat bounds exceed 90 or lon bounds within ±90 while lat bounds within ±180
      if ((Math.abs(nLat) > 90 || Math.abs(xLat) > 90) || (Math.abs(nLon) <= 90 && Math.abs(xLon) <= 90 && (Math.abs(nLat) <= 180 && Math.abs(xLat) <= 180))) {
        try {
          feature.geometry = transformGeometryCoordinates(feature.geometry, ([a, b]) => [b, a]);
          geometryStats = getGeometryStats(feature.geometry);
          if (geometryStats) return true;
        } catch (e) { /* ignore and fail later */ }
      }

      return false;
    }

    const fixed = tryFixBounds();
    if (!fixed) {
      if (geometryStats) {
        throw new Error(`generate-world-countries: geometry for ${displayName} has invalid bounds after normalization: ${JSON.stringify(geometryStats.bounds)}`);
      }
      throw new Error(`generate-world-countries: unable to compute geometry stats for ${displayName}`);
    }
  }

  return {
    ...feature,
    properties: {
      ...properties,
      name: displayName,
      displayName,
      aliases,
      synonyms: aliases,
      continent: continents[0] || null,
      continents,
      isoCode,
      flagEmoji: flagEmojiFromCountryCode(isoCode),
      geometryBounds: geometryStats?.bounds ?? null,
      geometryCenter: geometryStats?.center ?? null,
      geometryPointCount: geometryStats?.pointCount ?? 0,
      geometryRingCount: geometryStats?.ringCount ?? 0
    }
  };
}

/**
 * Build a `neighbors` list for each feature.
 *
 * Strategy: snap every border vertex to a grid (2 decimal places ≈ 1 km),
 * record which countries own each snapped vertex, then flag any pair that
 * shares at least one vertex as neighbors.
 *
 * Two decimal places is coarse enough to paper over tiny float differences
 * in Natural Earth data while being fine enough to avoid false positives
 * across open water.
 */
function computeNeighbors(features) {
  // Map from snapped vertex key -> Set of country names that touch it.
  const vertexOwners = new Map();

  for (const feature of features) {
    const name = feature?.properties?.name;
    if (!name || !feature.geometry) continue;

    visitCoordinates(feature.geometry.coordinates, ([lon, lat]) => {
      const key = `${lon.toFixed(2)},${lat.toFixed(2)}`;
      if (!vertexOwners.has(key)) vertexOwners.set(key, new Set());
      vertexOwners.get(key).add(name);
    });
  }

  // Collect neighbor pairs from shared vertices.
  const neighborSets = new Map(features.map((f) => [f.properties?.name, new Set()]));

  for (const owners of vertexOwners.values()) {
    if (owners.size < 2) continue;
    const names = Array.from(owners);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        neighborSets.get(names[i])?.add(names[j]);
        neighborSets.get(names[j])?.add(names[i]);
      }
    }
  }

  return neighborSets;
}

async function main() {
  const rawJson = await readFile(sourcePath, 'utf8');
  const source = JSON.parse(rawJson);
  const features = Array.isArray(source.features) ? source.features : [];
  const normalizedFeatures = features
    .map(normalizeFeature)
    .filter((feature) => Boolean(feature?.properties?.name))
    // Temporarily omit Antarctica to avoid oversized mesh rendering issues.
    .filter((feature) => String(feature.properties.name).toLowerCase() !== 'antarctica');

  // Compute adjacency from shared border vertices.
  const neighborSets = computeNeighbors(normalizedFeatures);

  // Build a name → isoCode lookup so we can emit compact ISO-2 codes.
  const isoCodeByName = new Map(
    normalizedFeatures.map((f) => [f.properties.name, f.properties.isoCode])
  );

  for (const feature of normalizedFeatures) {
    const name = feature.properties.name;
    const neighborNames = Array.from(neighborSets.get(name) ?? []).sort();
    feature.properties.neighbors = neighborNames;
    // Emit ISO-2 codes for neighbors that have one; omit nulls.
    feature.properties.neighborIsoCodes = neighborNames
      .map((n) => isoCodeByName.get(n))
      .filter(Boolean);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });

  const output = {
    type: 'FeatureCollection',
    generatedAt: new Date().toISOString(),
    source: path.relative(scriptDir, sourcePath),
    schema: 'worldle-lite-country-render-v1',
    features: normalizedFeatures
  };

  await writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${normalizedFeatures.length} normalized country features to ${path.relative(scriptDir, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});