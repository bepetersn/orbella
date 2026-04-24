/**
 * @fileoverview Geometry utilities for polygon processing and continent-aware filtering.
 *
 * Provides functions for extracting polygon parts from GeoJSON features and
 * continent-aware multipolygon trimming for regional map views.
 *
 * When the player filters by continent, countries such as Russia and France
 * that span multiple continents would otherwise render stray territory outside
 * the visible region. `createContinentGeometryFilter` trims each country's
 * polygon parts to those whose centroid falls within the statistical bounding
 * box of the selected continent.
 */

// ============================================================================
// Polygon Geometry Processing
// ============================================================================

function getGeometryPolygonParts(feature) {
  const geometry = feature?.geometry;

  if (!geometry) {
    return [];
  }

  if (geometry.type === "Polygon") {
    return [geometry.coordinates];
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates;
  }

  return [];
}

function createPolygonFeature(properties, polygonCoordinates) {
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "Polygon",
      coordinates: polygonCoordinates
    }
  };
}

// ============================================================================
// Continent-Aware Geometry Filtering
// ============================================================================


function _getPartStats(deps, feature, partCoordinates) {
  const { d3, path, projection } = deps;
  const partFeature = createPolygonFeature(feature.properties, partCoordinates);
  const geoCentroid = d3.geoCentroid(partFeature);
  const projectedGeoCentroid = projection(geoCentroid);
  const centroid = Array.isArray(projectedGeoCentroid)
    && Number.isFinite(projectedGeoCentroid[0])
    && Number.isFinite(projectedGeoCentroid[1])
    ? projectedGeoCentroid
    : path.centroid(partFeature);
  const safeCentroid = [
    Number.isFinite(centroid[0]) ? centroid[0] : 0,
    Number.isFinite(centroid[1]) ? centroid[1] : 0
  ];

  return {
    coordinates: partCoordinates,
    area: d3.geoArea(partFeature),
    centroid: safeCentroid,
    geoCentroid
  };
}

/**
 * Build a feature with the given parts, handling single vs multi-polygon geometry.
 */
function _buildFeatureFromParts(feature, parts) {
  if (!parts.length) {
    return feature;
  }

  if (parts.length === 1) {
    return {
      ...feature,
      geometry: {
        type: "Polygon",
        coordinates: parts[0]
      }
    };
  }

  return {
    ...feature,
    geometry: {
      type: "MultiPolygon",
      coordinates: parts
    }
  };
}

/**
 * Return a `Map<string, GeoJSONFeature>` suitable for rendering.  For
 * countries that have polygon parts outside `continentName`, only the
 * parts whose centroid falls within the continent's bounding box are kept.
 * Single-continent countries are returned unmodified.
 *
 * @param {object}        deps
 * @param {object[]}      allCountriesData  Normalised GeoJSON feature array.
 * @param {string | null} continentName     Active continent filter, or `null` for all.
 * @returns {Map<string, object>}
 */
function buildRenderableMapForContinent(deps, allCountriesData, continentName) {
  const { getCountryKey, matchesContinent } = deps;

  // 1. Build the default untrimmed render map.
  const defaultMap = new Map(
    allCountriesData.map((country) => [getCountryKey(country), country])
  );

  if (!continentName) {
    return defaultMap;
  }

  // 2. Narrow to countries that belong to the selected continent.
  const countriesInContinent = allCountriesData
    .filter((country) => matchesContinent(country, continentName));

  if (!countriesInContinent.length) {
    return defaultMap;
  }

  // 3. Compute per-country polygon-part stats (area + centroids).
  const countryStats = countriesInContinent
    .map((country) => {
      const parts = getGeometryPolygonParts(country)
        .map((partCoordinates) => _getPartStats(deps, country, partCoordinates));

      if (!parts.length) {
        return null;
      }

      const primaryPart = parts.reduce((largest, current) => (
        current.area > largest.area ? current : largest
      ));

      return {
        country,
        parts,
        primaryPart
      };
    })
    .filter(Boolean);

  if (!countryStats.length) {
    return defaultMap;
  }

  // 4. Keep only parts geographically close to each country's primary part.
  
  // Keep polygon parts whose geographic centroid is within MAX_PART_GEO_DISTANCE_RAD
  // of the country's primary part centroid.  This is projection-agnostic and correctly
  // retains outlier-but-contiguous territory (e.g. Alaska, ~42°) while trimming
  // distant overseas territories (e.g. French Guiana from France, ~70°).
  const MAX_PART_GEO_DISTANCE_RAD = 60 * Math.PI / 180;

  countryStats.forEach((entry) => {
    const primaryGeoCentroid = entry.primaryPart.geoCentroid;

    const keptPartStats = entry.parts
      .filter((part) =>
        part === entry.primaryPart ||
        deps.d3.geoDistance(part.geoCentroid, primaryGeoCentroid) <= MAX_PART_GEO_DISTANCE_RAD
      );

    const keptParts = keptPartStats.map((part) => part.coordinates);

    if (!keptParts.length) {
      defaultMap.set(getCountryKey(entry.country), _buildFeatureFromParts(entry.country, [entry.primaryPart.coordinates]));
      return;
    }

    defaultMap.set(getCountryKey(entry.country), _buildFeatureFromParts(entry.country, keptParts));
  });

  // 5. Return the continent-trimmed render map.
  return defaultMap;
}

/**
 * Create a geometry filter tied to the given D3 projection and path generator.
 *
 * @param {object}    options
 * @param {object}    options.d3                       D3 v7 library reference.
 * @param {Function}  options.path                     D3 geo path generator.
 * @param {Function}  options.projection               D3 geo projection.
 * @param {Function}  [options.isCountryInContinent]   Predicate `(country, continentName) => boolean`.
 * @param {Function}  options.getCountryKey            `(feature) => string` lower-cased country key.
 * @returns {{ buildRenderableMapForContinent: Function }}
 */
function createContinentGeometryFilter({ d3, path, projection, isCountryInContinent, getCountryKey }) {
  const matchesContinent = typeof isCountryInContinent === "function"
    ? isCountryInContinent
    : (country, continentName) => country?.properties?.continent === continentName;

  const deps = {
    d3,
    path,
    projection,
    getCountryKey,
    matchesContinent
  };

  return {
    buildRenderableMapForContinent: buildRenderableMapForContinent.bind(null, deps)
  };
}

// Export for window global access (maintains backward compatibility)
if (typeof window !== 'undefined') {
  window.continentGeometry = {
    createContinentGeometryFilter
  };
}
