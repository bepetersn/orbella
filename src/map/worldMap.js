/**
 * @fileoverview SVG world-map rendering and interaction layer.
 *
 * `createWorldMap` initialises a D3-powered SVG map, fetches and normalises
 * GeoJSON country data, renders `<path>` elements for each country, and
 * exposes methods for marking round state (target / correct / wrong) and
 * animating zoom-to-country transitions.
 *
 * Exported as {@link window.worldMap}.
 */

// Constants: Animation durations, thresholds, and visual styling
// ============================================================================

const ZOOM_DURATION_MS = 1000;
const ZOOM_PROPORTIONAL_SCALE_FACTOR = 0.6;
const ZOOM_MAX_SCALE_DEFAULT = 12;
const ZOOM_MAX_SCALE_SMALL_COUNTRY = 20;
const SMALL_COUNTRY_AREA_THRESHOLD = 400;
const ZOOM_VIEWPORT_PADDING_RATIO = 0.08;
const HALO_SIZE_THRESHOLD = 20;
const HALO_STROKE_COLOR = "#f5c518";
const HALO_STROKE_WIDTH = 2;
const HALO_DURATION_MS = 1800;
const HALO_RADIUS = 80;

// Utility Functions: String transformation, object access, dimensions
// ============================================================================

function safeId(name) {
  return "c_" + name.replace(/[^a-zA-Z0-9]/g, "_");
}

function getSvgDimensions(ctx) {
  const svgNode = ctx.svg.node();
  const bounds = svgNode.getBoundingClientRect();

  return {
    actualWidth: bounds.width || svgNode.clientWidth || ctx.width,
    actualHeight: bounds.height || svgNode.clientHeight || ctx.height
  };
}

const flagDisplayNames = typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
  ? new Intl.DisplayNames(["en"], { type: "region" })
  : null;

const normalizedFlagCodeOverrides = new Map([
  ["czech republic", "CZ"],
  ["democratic republic of the congo", "CD"],
  ["east timor", "TL"],
  ["ivory coast", "CI"],
  ["myanmar", "MM"],
  ["palestine", "PS"],
  ["people s republic of china", "CN"],
  ["republic of the congo", "CG"],
  ["saint kitts and nevis", "KN"],
  ["saint lucia", "LC"],
  ["saint vincent and the grenadines", "VC"],
  ["the bahamas", "BS"],
  ["the gambia", "GM"],
  ["turkey", "TR"],
  ["united states of america", "US"],
  ["benin", "BJ"],
  ["burkina faso", "BF"],
  ["france", "FR"],
  ["germany", "DE"],
  ["russia", "RU"],
  ["serbia", "RS"],
  ["united kingdom", "GB"],
  ["vanuatu", "VU"],
  ["vietnam", "VN"],
  ["yemen", "YE"],
  ["zimbabwe", "ZW"]
]);

let regionNameToCodes = null;

function normalizeCountryLookupName(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/&/gu, " and ")
    .replace(/[’'`´]/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function buildRegionNameToCodes() {
  if (regionNameToCodes) {
    return regionNameToCodes;
  }

  const lookup = new Map();

  if (flagDisplayNames) {
    for (let first = 65; first <= 90; first += 1) {
      for (let second = 65; second <= 90; second += 1) {
        const code = String.fromCharCode(first, second);
        const label = flagDisplayNames.of(code);
        if (!label) {
          continue;
        }

        const normalizedLabel = normalizeCountryLookupName(label);
        const existing = lookup.get(normalizedLabel) || [];
        lookup.set(normalizedLabel, [...existing, code]);
      }
    }
  }

  regionNameToCodes = lookup;
  return lookup;
}

function resolveCountryFlagCode(countryName) {
  const normalizedName = normalizeCountryLookupName(countryName);

  if (!normalizedName) {
    return null;
  }

  const override = normalizedFlagCodeOverrides.get(normalizedName);
  if (override) {
    return override;
  }

  const matches = buildRegionNameToCodes().get(normalizedName) || [];
  return matches.length === 1 ? matches[0] : null;
}

function flagEmojiFromCountryCode(countryCode) {
  const alpha2Code = String(countryCode ?? "").trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(alpha2Code)) {
    return null;
  }

  const firstRegionalIndicator = 0x1f1e6 + (alpha2Code.charCodeAt(0) - 65);
  const secondRegionalIndicator = 0x1f1e6 + (alpha2Code.charCodeAt(1) - 65);
  return String.fromCodePoint(firstRegionalIndicator, secondRegionalIndicator);
}

// Data Processing & Lookup: Feature normalization, validation, and country querying
// ============================================================================

function normalizeCountryFeature(ctx, feature) {
  const normalizedName = feature?.properties?.[ctx.countryNameProperty];
  const sourceContinent = feature?.properties?.[ctx.countryContinentProperty];
  const aliasNames = [...new Set(
    (feature?.properties?.NAME_ALIASES || [])
      .filter((aliasName) => typeof aliasName === "string")
      .map((aliasName) => aliasName.trim())
      .filter(Boolean)
  )];

  if (!normalizedName) {
    return feature;
  }

  const overrideKey = normalizedName.trim().toLowerCase();
  const configuredMemberships = ctx.countryContinentMemberships.get(overrideKey) || [];
  const normalizedMemberships = [...new Set([
    sourceContinent,
    ...configuredMemberships
  ].filter(Boolean))];
  const normalizedContinent = normalizedMemberships[0] || sourceContinent;
  const flagCode = resolveCountryFlagCode(normalizedName);

  return {
    ...feature,
    properties: {
      ...feature.properties,
      name: normalizedName,
      displayName: normalizedName,
      aliases: aliasNames,
      synonyms: aliasNames,
      continent: normalizedContinent,
      continents: normalizedMemberships,
      flagCode,
      flagEmoji: flagEmojiFromCountryCode(flagCode)
    }
  };
}

function isCountryInContinent(country, continentName) {
  if (!continentName) {
    return true;
  }

  const memberships = country?.properties?.continents;
  if (Array.isArray(memberships) && memberships.length > 0) {
    return memberships.includes(continentName);
  }

  return country?.properties?.continent === continentName;
}

function isPlayableCountry(feature) {
  const { name } = feature.properties ?? {};
  return Boolean(name)
    && !feature.properties?.EXCLUDED;
}

function getCountryKey(feature) {
  return String(feature?.properties?.name ?? "").trim().toLowerCase();
}

function getRenderableFeature(ctx, feature) {
  const keyedFeature = ctx.renderFeatureByName.get(getCountryKey(feature));
  return keyedFeature || feature;
}

// Map Rendering & Filtering: Build renderable maps and apply visibility filters
// ============================================================================

function buildRenderableMapForContinent(ctx, continentName) {
  const allCountriesData = Array.isArray(ctx.allCountriesData) ? ctx.allCountriesData : [];

  if (!ctx.geometryFilter) {
    return new Map(
      allCountriesData.map((country) => [getCountryKey(country), country])
    );
  }

  return ctx.geometryFilter.buildRenderableMapForContinent(allCountriesData, continentName);
}

function applyContinentVisibilityFilter(ctx) {
  ctx.g.selectAll(".country")
    .attr("d", (country) => ctx.path(getRenderableFeature(ctx, country)))
    .style("display", (country) => {
      if (!ctx.activeContinentFilter) {
        return null;
      }

      return isCountryInContinent(country, ctx.activeContinentFilter) ? null : "none";
    });
}

// Data Loading: Load GeoJSON, normalize, render, and filter
// ============================================================================

async function loadCountries(ctx) {
  ctx.geometryFilter = window.continentGeometry?.createContinentGeometryFilter({
    d3: ctx.d3,
    path: ctx.path,
    projection: ctx.projection,
    isCountryInContinent,
    getCountryKey
  }) ?? null;

  const data = await ctx.d3.json(ctx.countriesGeoJsonUrl);
  const countriesData = data.features
    .map((feature) => normalizeCountryFeature(ctx, feature))
    .filter(isPlayableCountry);

  ctx.allCountriesData = countriesData;
  ctx.renderFeatureByName = buildRenderableMapForContinent(ctx, null);

  const countryNames = countriesData
    .map((country) => country.properties.name)
    .sort();
  const countryByName = new Map(
    countriesData
      .map((country) => [country.properties.name.toLowerCase(), country])
  );

  ctx.g.selectAll("path")
    .data(countriesData)
    .enter()
    .append("path")
    .attr("d", ctx.path)
    .attr("class", "country")
    .attr("id", (country) => safeId(country.properties.name))
    .attr("vector-effect", "non-scaling-stroke");

  applyContinentVisibilityFilter(ctx);

  return { countriesData, countryNames, countryByName };
}

function setRegionFilter(ctx, regionName) {
  ctx.activeContinentFilter = regionName ? String(regionName).trim() : null;
  ctx.renderFeatureByName = buildRenderableMapForContinent(ctx, ctx.activeContinentFilter);
  applyContinentVisibilityFilter(ctx);
}

// Round State Management: Mark and reset country states (target, solved, wrong)
// ============================================================================

function resetRoundState(ctx) {
  ctx.g.selectAll(".location-halo").remove();
  ctx.g.selectAll(".country")
    .interrupt()
    .style("fill", null)
    .style("stroke", null)
    .classed("target", false)
    .classed("correct", false)
    .classed("wrong", false);
}

function markTarget(ctx, country) {
  ctx.g.select("#" + safeId(String(country?.properties?.displayName ?? country?.properties?.name ?? country ?? ""))).classed("target", true);
}

function markSolved(ctx, country) {
  ctx.g.select("#" + safeId(String(country?.properties?.displayName ?? country?.properties?.name ?? country ?? "")))
    .classed("target", false)
    .classed("correct", true);
}

function markWrong(ctx, countryOrName) {
  const element = ctx.g.select("#" + safeId(String(countryOrName?.properties?.displayName ?? countryOrName?.properties?.name ?? countryOrName ?? "")));
  element.interrupt()
    .classed("wrong", true)
    .transition()
    .duration(800)
    .style("fill", "var(--wrong-persist)")
    .style("stroke", "var(--wrong-persist-str)");
}

// Geometry Processing: Extract and convert polygon geometry data
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

// Animations: Calculate and zoom; location halo for small countries
// ============================================================================

function getZoomFrameMetrics(ctx, country) {
  
  // 1. Get renderable country and compute fallback bounding box
  const renderableCountry = getRenderableFeature(ctx, country);
  const fallbackBounds = ctx.path.bounds(renderableCountry);
  const fallbackDx = fallbackBounds[1][0] - fallbackBounds[0][0];
  const fallbackDy = fallbackBounds[1][1] - fallbackBounds[0][1];
  const fallbackCenterX = (fallbackBounds[0][0] + fallbackBounds[1][0]) / 2;
  const fallbackCenterY = (fallbackBounds[0][1] + fallbackBounds[1][1]) / 2;
  
  // 2. Extract geometry polygon parts (handle simple vs multi-polygon countries)
  const geometryParts = getGeometryPolygonParts(renderableCountry);

  if (geometryParts.length < 2) {
    return {
      dx: fallbackDx,
      dy: fallbackDy,
      centerX: fallbackCenterX,
      centerY: fallbackCenterY
    };
  }

  // 3. Compute bounding box for each polygon part, filtering invalid bounds
  const partBounds = geometryParts
    .map((polygonCoordinates) => ctx.path.bounds(createPolygonFeature(renderableCountry.properties, polygonCoordinates)))
    .filter((bounds) => Number.isFinite(bounds?.[0]?.[0]) && Number.isFinite(bounds?.[0]?.[1])
      && Number.isFinite(bounds?.[1]?.[0]) && Number.isFinite(bounds?.[1]?.[1]))
    .map((bounds) => ({
      minX: bounds[0][0],
      minY: bounds[0][1],
      maxX: bounds[1][0],
      maxY: bounds[1][1],
      centerX: (bounds[0][0] + bounds[1][0]) / 2
    }));

  if (partBounds.length < 2) {
    return {
      dx: fallbackDx,
      dy: fallbackDy,
      centerX: fallbackCenterX,
      centerY: fallbackCenterY
    };
  }

  // 4. Compute projection metrics to handle world wrapping at date line
  const projectedEast = ctx.projection([180, 0]);
  const projectedWest = ctx.projection([-180, 0]);
  const projectedOrigin = ctx.projection([0, 0]);
  const projectedWorldWidth = Math.abs((projectedEast?.[0] ?? 0) - (projectedWest?.[0] ?? 0));

  if (!Number.isFinite(projectedWorldWidth) || projectedWorldWidth <= 0) {
    return {
      dx: fallbackDx,
      dy: fallbackDy,
      centerX: fallbackCenterX,
      centerY: fallbackCenterY
    };
  }

  // 5. Determine shift options for wrapping parts across date line
  const mapCenterX = Number.isFinite(projectedOrigin?.[0]) ? projectedOrigin[0] : fallbackCenterX;
  const shiftOptions = [-projectedWorldWidth, 0, projectedWorldWidth];

  // 6. For each part, find optimal frame that minimizes total area
  //    6a. For each candidate anchor point
  //    6b. Find best shift for each part relative to anchor
  //    6c. Compute bounding box for shifted parts
  //    6d. Normalize center to viewport
  const candidateFrames = partBounds.map((anchor) => {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    partBounds.forEach((part) => {
      const bestShift = shiftOptions.reduce((best, shift) => {
        const shiftedCenter = part.centerX + shift;
        const shiftedDistance = Math.abs(shiftedCenter - anchor.centerX);
        return shiftedDistance < best.distance
          ? { shift, distance: shiftedDistance }
          : best;
      }, { shift: 0, distance: Number.POSITIVE_INFINITY }).shift;

      minX = Math.min(minX, part.minX + bestShift);
      maxX = Math.max(maxX, part.maxX + bestShift);
      minY = Math.min(minY, part.minY);
      maxY = Math.max(maxY, part.maxY);
    });

    const rawCenterX = (minX + maxX) / 2;
    const normalizedCenterX = rawCenterX
      - Math.round((rawCenterX - mapCenterX) / projectedWorldWidth) * projectedWorldWidth;

    return {
      dx: maxX - minX,
      dy: maxY - minY,
      centerX: normalizedCenterX,
      centerY: (minY + maxY) / 2,
      area: (maxX - minX) * (maxY - minY)
    };
  });

  // 7. Select candidate frame with smallest area
  const bestFrame = candidateFrames.reduce((best, candidate) => {
    if (!best) {
      return candidate;
    }

    if (candidate.area < best.area) {
      return candidate;
    }

    return best;
  }, null);

  return bestFrame || {
    dx: fallbackDx,
    dy: fallbackDy,
    centerX: fallbackCenterX,
    centerY: fallbackCenterY
  };
}

function zoomToCountry(ctx, country) {
  const { actualWidth, actualHeight } = getSvgDimensions(ctx);
  const { dx, dy, centerX, centerY } = getZoomFrameMetrics(ctx, country);

  const maxScaleLimit = dx * dy < SMALL_COUNTRY_AREA_THRESHOLD
    ? ZOOM_MAX_SCALE_SMALL_COUNTRY
    : ZOOM_MAX_SCALE_DEFAULT;
  const normalizedSpan = Math.max(dx / actualWidth, dy / actualHeight);
  const proportionalScale = ZOOM_PROPORTIONAL_SCALE_FACTOR / (normalizedSpan + ZOOM_VIEWPORT_PADDING_RATIO);
  const scale = Math.max(1, Math.min(maxScaleLimit, proportionalScale));

  const translateX = actualWidth / 2 - scale * centerX;
  const translateY = actualHeight / 2 - scale * centerY;

  ctx.svg.transition()
    .duration(ZOOM_DURATION_MS)
    .call(ctx.zoom.transform, ctx.d3.zoomIdentity.translate(translateX, translateY).scale(scale));
}

function showLocationHalo(ctx, country) {
  const renderableCountry = getRenderableFeature(ctx, country);
  ctx.g.selectAll(".location-halo").interrupt().remove();
  const bounds = ctx.path.bounds(renderableCountry);
  const dx = bounds[1][0] - bounds[0][0];
  const dy = bounds[1][1] - bounds[0][1];

  if (dx < HALO_SIZE_THRESHOLD || dy < HALO_SIZE_THRESHOLD) {
    const centroid = ctx.path.centroid(renderableCountry);
    const transform = ctx.d3.zoomTransform(ctx.svg.node());
    const k = transform.k;

    const halo = ctx.g.append("circle")
      .attr("class", "location-halo")
      .attr("cx", centroid[0])
      .attr("cy", centroid[1])
      .attr("r", 0)
      .style("stroke", HALO_STROKE_COLOR)
      .style("stroke-width", HALO_STROKE_WIDTH / k)
      .style("opacity", 1);

    halo.transition()
      .duration(HALO_DURATION_MS)
      .ease(ctx.d3.easeCircleOut)
      .attr("r", HALO_RADIUS / k)
      .style("opacity", 0)
      .remove();
  }
}

// Factory Function: Create and initialize the world map
// ============================================================================

/**
 * Create and mount a world map into the SVG element matched by `selector`.
 *
 * @param {object}         options
 * @param {object}         options.d3                          D3 v7 library reference.
 * @param {string}         options.selector                    CSS selector for the `<svg>` element.
 * @param {number}         options.width                       Logical SVG width in pixels.
 * @param {number}         options.height                      Logical SVG height in pixels.
 * @param {string}         options.countriesGeoJsonUrl         URL of the GeoJSON data file.
 * @param {string}         [options.countryNameProperty]       GeoJSON property key for the display name.
 * @param {string}         [options.countryContinentProperty]  GeoJSON property key for the continent name.
 * @param {Map<string,string[]>} [options.countryContinentMemberships] Manual continent overrides keyed by lower-cased country name.
 * @returns {{ loadCountries: Function, resetRoundState: Function, markTarget: Function, markSolved: Function, markWrong: Function, zoomToCountry: Function, showLocationHalo: Function, setRegionFilter: Function, safeId: Function }}
 */
function createWorldMap({
  d3,
  selector,
  width,
  height,
  countriesGeoJsonUrl,
  countryNameProperty = "name",
  countryContinentProperty = "continent",
  countryContinentMemberships = new Map()
}) {
  const svg = d3.select(selector);
  const { actualWidth, actualHeight } = getSvgDimensions({ svg, width, height });
  const g = svg.append("g");
  const projection = d3.geoNaturalEarth1().scale(160).translate([actualWidth / 2, actualHeight / 2]);
  const path = d3.geoPath(projection);

  const ctx = {
    d3,
    svg,
    width,
    height,
    countriesGeoJsonUrl,
    countryNameProperty,
    countryContinentProperty,
    countryContinentMemberships,
    g,
    projection,
    path,
    activeContinentFilter: null,
    allCountriesData: [],
    renderFeatureByName: new Map(),
    geometryFilter: null,
    zoom: null
  };

  ctx.zoom = d3.zoom()
    .scaleExtent([1, 100])
    .on("zoom", (event) => {
      ctx.g.attr("transform", event.transform);
    });

  svg.call(ctx.zoom);

  return {
    loadCountries: () => loadCountries(ctx),
    resetRoundState: () => resetRoundState(ctx),
    markTarget: (country) => markTarget(ctx, country),
    markSolved: (country) => markSolved(ctx, country),
    markWrong: (countryName) => markWrong(ctx, countryName),
    zoomToCountry: (country) => zoomToCountry(ctx, country),
    showLocationHalo: (country) => showLocationHalo(ctx, country),
    setRegionFilter: (regionName) => setRegionFilter(ctx, regionName),
    safeId
  };
}

// Module Export
// ============================================================================

window.worldMap = {
  createWorldMap
};
