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
 * Return true if the centroid [lon, lat] of a polygon part falls inside any
 * of the exclusion bounding boxes `[[minLon, minLat, maxLon, maxLat], ...]`.
 */
function _isExcludedByBounds(geoCentroid, exclusionBoxes) {
  const [lon, lat] = geoCentroid;
  return exclusionBoxes.some(
    ([minLon, minLat, maxLon, maxLat]) =>
      lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat
  );
}

/**
 * Strip any polygon parts that are explicitly excluded via
 * `deps.excludedPolygonBounds` (a `Map<string, number[][]>`).  Returns the
 * feature unmodified when there are no exclusions configured for it.
 */
function _applyExclusionBounds(deps, country) {
  const excludedBounds = deps.excludedPolygonBounds;
  if (!excludedBounds || excludedBounds.size === 0) {
    return country;
  }

  const key = deps.getCountryKey(country);
  const boxes = excludedBounds.get(key);
  if (!boxes || !boxes.length) {
    return country;
  }

  const parts = getGeometryPolygonParts(country);
  if (parts.length <= 1) {
    return country;
  }

  const keptParts = parts.filter((partCoordinates) => {
    const partFeature = createPolygonFeature(country.properties, partCoordinates);
    const geoCentroid = deps.d3.geoCentroid(partFeature);
    return !_isExcludedByBounds(geoCentroid, boxes);
  });

  if (keptParts.length === parts.length) {
    return country;
  }

  // Always keep at least the first part so the country isn't invisible.
  const finalParts = keptParts.length > 0 ? keptParts : [parts[0]];
  return _buildFeatureFromParts(country, finalParts);
}

/**
 * Return a `Map<string, GeoJSONFeature>` suitable for rendering.  When
 * `continentName` is set, countries that span multiple continents have their
 * out-of-continent polygon parts trimmed using the geographic-distance
 * heuristic.  Regardless of continent filter, any parts explicitly listed in
 * `deps.excludedPolygonBounds` are always stripped (e.g. French Guiana from
 * France).
 *
 * @param {object}        deps
 * @param {object[]}      allCountriesData  Normalised GeoJSON feature array.
 * @param {string | null} continentName     Active continent filter, or `null` for all.
 * @returns {Map<string, object>}
 */
function buildRenderableMapForContinent(deps, allCountriesData, continentName) {
  const { getCountryKey, matchesContinent } = deps;

  // 1. Apply explicit exclusion bounds to every country (always active).
  const trimmedData = allCountriesData.map((country) => _applyExclusionBounds(deps, country));

  // 2. Build the base render map from exclusion-trimmed data.
  const defaultMap = new Map(
    trimmedData.map((country) => [getCountryKey(country), country])
  );

  if (!continentName) {
    return defaultMap;
  }

  // 3. Narrow to countries that belong to the selected continent.
  const countriesInContinent = trimmedData
    .filter((country) => matchesContinent(country, continentName));

  if (!countriesInContinent.length) {
    return defaultMap;
  }

  // 4. Compute per-country polygon-part stats (area + centroids).
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

  // 5. Keep only parts geographically close to each country's primary part.
  //    Retains contiguous outliers like Alaska (~42°) while trimming truly
  //    distant parts.
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

  // 6. Return the continent-trimmed render map.
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
function createContinentGeometryFilter({ d3, path, projection, isCountryInContinent, getCountryKey, excludedPolygonBounds }) {
  const matchesContinent = typeof isCountryInContinent === "function"
    ? isCountryInContinent
    : (country, continentName) => country?.properties?.continent === continentName;

  const deps = {
    d3,
    path,
    projection,
    getCountryKey,
    matchesContinent,
    excludedPolygonBounds: excludedPolygonBounds instanceof Map ? excludedPolygonBounds : new Map()
  };

  return {
    buildRenderableMapForContinent: buildRenderableMapForContinent.bind(null, deps)
  };
}

// ============================================================================
// Proximity Utilities (distance + bearing between two country centers)
// ============================================================================

/**
 * Compute the great-circle distance in kilometres between two [lon, lat] points
 * using the Haversine formula.
 *
 * @param {[number, number]} centerA  [lon, lat] of the first point.
 * @param {[number, number]} centerB  [lon, lat] of the second point.
 * @returns {number}  Distance in km, rounded to the nearest integer.
 */
function haversineDistanceKm(centerA, centerB) {
  const R = 6371; // Earth's mean radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const [lon1, lat1] = centerA;
  const [lon2, lat2] = centerB;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Compute the initial compass bearing (in degrees, 0 = North, clockwise) from
 * `centerA` toward `centerB`, then map it to one of 8 Unicode arrow characters.
 *
 * @param {[number, number]} centerA  [lon, lat] of the origin point.
 * @param {[number, number]} centerB  [lon, lat] of the destination point.
 * @returns {string}  One of ↑ ↗ → ↘ ↓ ↙ ← ↖
 */
function compassBearing(centerA, centerB) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const [lon1, lat1] = centerA;
  const [lon2, lat2] = centerB;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  const arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
  const index = Math.round(bearing / 45) % 8;
  return arrows[index];
}

export { getGeometryPolygonParts, createPolygonFeature, buildRenderableMapForContinent, createContinentGeometryFilter, haversineDistanceKm, compassBearing };

export const continentGeometry = {
  createContinentGeometryFilter,
  haversineDistanceKm,
  compassBearing
};


