/**
 * @fileoverview SVG world-map rendering and interaction layer.
 *
 * `createWorldMap` initialises a D3-powered SVG map, fetches country data,
 * renders `<path>` elements for each country, and
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
const DEFAULT_PROJECTION_MODE = "3d";
const PROJECTION_MODE_FLAT = "flat";
const PROJECTION_MODE_3D = "3d";
const PROJECTION_MODE_ROUNDED = "rounded";
const PROJECTION_MODE_ORTHOGRAPHIC = "orthographic";

// Pan / interaction tuning
const DEFAULT_PAN_SENSITIVITY_X = 1.0; // horizontal drag -> degrees multiplier
const DEFAULT_PAN_SENSITIVITY_Y = 1.0; // vertical drag -> degrees multiplier
const MAX_LATITUDE = 90.0; // clamp latitude (inclusive) to allow facing poles
const DEBUG_MAP_INTERACTIONS = false; // set true to enable verbose logs

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

function normalizeProjectionMode(value) {
  const mode = String(value ?? DEFAULT_PROJECTION_MODE).trim().toLowerCase();

  if (
    mode === PROJECTION_MODE_FLAT
    || mode === PROJECTION_MODE_3D
    || mode === PROJECTION_MODE_ROUNDED
    || mode === PROJECTION_MODE_ORTHOGRAPHIC
  ) {
    return mode;
  }

  return DEFAULT_PROJECTION_MODE;
}

function toRadians(value) {
  return value * Math.PI / 180;
}

// Helper to project a lon/lat point using ctx.projection, supporting both
// d3 projection functions and the custom globe projection object.
function resolveProjectionPoint(ctx, point) {
  try {
    if (!ctx || !ctx.projection) return null;
    if (typeof ctx.projection === "function") {
      return ctx.projection(point);
    }

    if (ctx.projection && typeof ctx.projection.projectPoint === "function") {
      return ctx.projection.projectPoint(point);
    }

    return null;
  } catch (e) {
    return null;
  }
}

// Projection rotation adapter: unify reading/writing rotation across
// custom globe objects (with `.rotation`) and D3 projections (with
// `.rotate()` getter/setter). Return [lon, lat] or [NaN, NaN] on error.
function getProjectionRotation(ctx) {
  try {
    if (!ctx || !ctx.projection) return [NaN, NaN];
    if (ctx.projection.rotation) {
      return [Number(ctx.projection.rotation.longitude || 0), Number(ctx.projection.rotation.latitude || 0)];
    }
    if (typeof ctx.projection.rotate === 'function') {
      const arr = ctx.projection.rotate();
      if (Array.isArray(arr)) {
        return [Number(arr[0] || 0), Number(arr[1] || 0)];
      }
    }
    // Fallback: return persisted raw longitude and zero latitude
    return [Number.isFinite(ctx._rawLongitude) ? Number(ctx._rawLongitude) : 0, 0];
  } catch (e) {
    return [NaN, NaN];
  }
}

function setProjectionRotation(ctx, lon, lat) {
  // Defer to existing canonical helper which clamps/normalizes values.
  try {
    applyRotationToProjection(ctx, lon, lat);
  } catch (e) {
    if (ctx && ctx.debugMapInteractions) console.error('setProjectionRotation failed', e);
  }
}

// Apply a rotation to the globe projection with clamped latitude and
// normalized longitude. Keeps an internal unwrapped longitude if present.
function applyRotationToProjection(ctx, lon, lat) {
  if (!ctx || !ctx.projection) return;

  // Support two projection styles:
  // 1) Our custom globe object (has .rotation property) used for perspective
  // 2) D3 projection objects (expose .rotate() method) used for azimuthal
  const hasRotationProp = Boolean(ctx.projection && ctx.projection.rotation);
  const hasRotateFn = typeof ctx.projection.rotate === "function";

  // Determine previous values safely
  const prevNormLon = hasRotationProp ? Number(ctx.projection.rotation.longitude || 0) : Number(ctx._rawLongitude || 0);
  const prevLat = hasRotationProp ? Number(ctx.projection.rotation.latitude || 0) : 0;
  const prevRawLon = Number.isFinite(ctx._rawLongitude) ? Number(ctx._rawLongitude) : prevNormLon;

  let rawLon = Number.isFinite(Number(lon)) ? Number(lon) : prevRawLon;
  let newLat = Number.isFinite(Number(lat)) ? Number(lat) : prevLat;

  // clamp latitude strictly inside ±maxLatitude to avoid pole singularities
  const userClampLat = Number.isFinite(ctx.maxLatitude) ? ctx.maxLatitude : MAX_LATITUDE;
  const safeEps = 1e-6;
  const clampLat = Math.max(0, userClampLat - safeEps);
  newLat = Math.max(-clampLat, Math.min(clampLat, newLat));

  // Persist raw (unwrapped) longitude so deltas accumulate without wrapping
  ctx._rawLongitude = rawLon;

  // Normalize longitude into [-180,180)
  const normLon = ((rawLon + 180) % 360 + 360) % 360 - 180;

  if (hasRotationProp) {
    // Custom globe object: set rotation properties directly
    ctx.projection.rotation.longitude = normLon;
    ctx.projection.rotation.latitude = newLat;
    return;
  }

  if (hasRotateFn) {
    // D3 projection: update using rotate(). When in transient polar azimuthal
    // view we want to keep the pole centered (±90) and only change the
    // center longitude. If no transient polar info exists, set the
    // second rotate angle to 0 so the projection centers on equator.
    const poleAngle = ctx._transientPolar ? (ctx._transientPolar.pole === "north" ? -90 : 90) : -newLat;
    try {
      ctx.projection.rotate([-normLon, poleAngle]);
    } catch (e) {
      // If rotate fails for any reason, silently ignore to avoid throwing
      if (ctx.debugMapInteractions) console.error('projection.rotate failed', e);
    }
    return;
  }

  // If neither mechanism is available, do nothing.
}

function createPerspectiveGlobeProjection({ actualWidth, actualHeight, mode, cameraDistance = 1.8 }) {
  const centerX = actualWidth / 2;
  const centerY = actualHeight / 2;
  const globeRadius = Math.min(actualWidth, actualHeight) * (mode === PROJECTION_MODE_FLAT ? 0.42 : 0.41);
  // Default cameraDistance reduced to 1.8 to increase visible horizon
  // (smaller values show more of the globe from a polar view).
  const cameraDistanceSafe = Number.isFinite(Number(cameraDistance)) ? Number(cameraDistance) : 1.8;
  const horizonZ = -1 / cameraDistanceSafe;

  // Minimal PerspectiveCamera-like parameters.
  // `fovDeg` approximates a real camera field-of-view in degrees.
  // `aspect` is width/height. We compute a pixel-space `focalLength`
  // from `fov` so the projection uses the standard focal/zcam formula.
  const fovDeg = 40; // tuneable: smaller -> more zoomed-in
  const aspect = actualWidth / actualHeight;
  const focalLength = (actualHeight / 2) / Math.tan(toRadians(fovDeg) / 2);
  const rotation = {
    longitude: -26,
    latitude: -14
  };

  function projectVector(vector) {
    const worldZ = cameraDistanceSafe + vector.z;
    const scale = focalLength / worldZ;

    return [
      centerX + vector.x * scale,
      centerY - vector.y * scale
    ];
  }

  function toSurfaceVector(point) {
    // Apply rotation to geographic coordinates. Clamp rotated latitude
    // into a safe range slightly inside ±90° to avoid crossing the pole
    // and causing geometry to appear from the opposite hemisphere.
    const safeMaxLat = 89.9999;
    let lon = (Number(point?.[0]) || 0) + rotation.longitude;
    let lat = (Number(point?.[1]) || 0) + rotation.latitude;

    if (lat > safeMaxLat) lat = safeMaxLat;
    if (lat < -safeMaxLat) lat = -safeMaxLat;

    const longitude = toRadians(lon);
    const latitude = toRadians(lat);

    return {
      x: Math.cos(latitude) * Math.sin(longitude),
      y: Math.sin(latitude),
      z: Math.cos(latitude) * Math.cos(longitude)
    };
  }

  function projectSurfacePoint(point) {
    const vector = toSurfaceVector(point);

    return {
      vector,
      screen: projectVector(vector),
      visible: vector.z >= horizonZ - 1e-6
    };
  }

  function projectPoint(point) {
    return projectVector(toSurfaceVector(point));
  }

  return {
    projectPoint,
    projectSurfacePoint,
    projectVector,
    radius: globeRadius,
    center: [centerX, centerY],
    cameraDistance,
    horizonZ,
    focalLength,
    rotation,
    camera: {
      fovDeg,
      aspect,
      positionZ: cameraDistance
    }
  };
}

function createPerspectivePathGenerator(globe) {
  const EPSILON = 1e-6;

  function updateBounds(bounds, point) {
    if (!Array.isArray(point) || point.length < 2) {
      return bounds;
    }

    const x = Number(point[0]);
    const y = Number(point[1]);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return bounds;
    }

    if (!bounds) {
      return {
        minX: x,
        minY: y,
        maxX: x,
        maxY: y
      };
    }

    return {
      minX: Math.min(bounds.minX, x),
      minY: Math.min(bounds.minY, y),
      maxX: Math.max(bounds.maxX, x),
      maxY: Math.max(bounds.maxY, y)
    };
  }

  function finalizeChunk(chunk, chunks) {
    if (Array.isArray(chunk) && chunk.length >= 3) {
      chunks.push(chunk);
    }
  }

  function clipToHorizon(previousPoint, currentPoint) {
    const denominator = currentPoint.vector.z - previousPoint.vector.z;

    if (Math.abs(denominator) < EPSILON) {
      return null;
    }

    const t = (globe.horizonZ - previousPoint.vector.z) / denominator;

    if (t < 0 || t > 1) {
      return null;
    }


    const vector = {
      x: previousPoint.vector.x + (currentPoint.vector.x - previousPoint.vector.x) * t,
      y: previousPoint.vector.y + (currentPoint.vector.y - previousPoint.vector.y) * t,
      z: globe.horizonZ
    };

    return {
      vector,
      screen: globe.projectVector(vector),
      visible: true
    };
  }

  function buildRingPath(ring) {
    if (!Array.isArray(ring) || ring.length < 2) {
      return { path: "", bounds: null };
    }

    const projectedPoints = ring.map((point) => globe.projectSurfacePoint(point));
    const chunks = [];
    let currentChunk = null;
    let bounds = null;
    let previousPoint = projectedPoints[0];

    if (previousPoint.visible) {
      currentChunk = [previousPoint.screen];
      bounds = updateBounds(bounds, previousPoint.screen);
    }

    for (let index = 1; index < projectedPoints.length; index += 1) {
      const currentPoint = projectedPoints[index];
      const previousVisible = previousPoint.visible;
      const currentVisible = currentPoint.visible;

      if (previousVisible && currentVisible) {
        if (!currentChunk) {
          currentChunk = [previousPoint.screen];
          bounds = updateBounds(bounds, previousPoint.screen);
        }

        currentChunk.push(currentPoint.screen);
        bounds = updateBounds(bounds, currentPoint.screen);
      } else if (previousVisible && !currentVisible) {
        if (!currentChunk) {
          currentChunk = [previousPoint.screen];
          bounds = updateBounds(bounds, previousPoint.screen);
        }

        const intersection = clipToHorizon(previousPoint, currentPoint);
        if (intersection) {
          currentChunk.push(intersection.screen);
          bounds = updateBounds(bounds, intersection.screen);
        }

        finalizeChunk(currentChunk, chunks);
        currentChunk = null;
      } else if (!previousVisible && currentVisible) {
        const intersection = clipToHorizon(previousPoint, currentPoint);
        currentChunk = intersection ? [intersection.screen, currentPoint.screen] : [currentPoint.screen];
        bounds = updateBounds(bounds, currentPoint.screen);
        if (intersection) {
          bounds = updateBounds(bounds, intersection.screen);
        }
      }

      previousPoint = currentPoint;
    }

    finalizeChunk(currentChunk, chunks);

    const path = chunks
      .map((chunk) => {
        const [firstPoint, ...rest] = chunk;
        const moveTo = `M${firstPoint[0]},${firstPoint[1]}`;
        const lineSegments = rest.map((point) => `L${point[0]},${point[1]}`).join(" ");
        return `${moveTo}${lineSegments ? ` ${lineSegments}` : ""} Z`;
      })
      .join(" ");

    return { path, bounds };
  }

  function buildFeatureGeometry(feature) {
    const geometry = feature?.geometry;

    if (!geometry) {
      return { path: "", bounds: null };
    }

    const polygonSets = geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];

    let pathParts = [];
    let bounds = null;

    polygonSets.forEach((polygonCoordinates) => {
      polygonCoordinates.forEach((ring) => {
        const ringResult = buildRingPath(ring);
        if (ringResult.path) {
          pathParts.push(ringResult.path);
        }

        if (ringResult.bounds) {
          bounds = bounds
            ? {
                minX: Math.min(bounds.minX, ringResult.bounds.minX),
                minY: Math.min(bounds.minY, ringResult.bounds.minY),
                maxX: Math.max(bounds.maxX, ringResult.bounds.maxX),
                maxY: Math.max(bounds.maxY, ringResult.bounds.maxY)
              }
            : { ...ringResult.bounds };
        }
      });
    });

    return {
      path: pathParts.join(" "),
      bounds
    };
  }

  const path = (feature) => buildFeatureGeometry(feature).path;

  path.bounds = (feature) => {
    const geometryResult = buildFeatureGeometry(feature);

    if (geometryResult.bounds) {
      return [
        [geometryResult.bounds.minX, geometryResult.bounds.minY],
        [geometryResult.bounds.maxX, geometryResult.bounds.maxY]
      ];
    }

    return [
      [globe.center[0], globe.center[1]],
      [globe.center[0], globe.center[1]]
    ];
  };

  path.centroid = (feature) => {
    const bounds = path.bounds(feature);
    return [
      (bounds[0][0] + bounds[1][0]) / 2,
      (bounds[0][1] + bounds[1][1]) / 2
    ];
  };

  return path;
}

function createMapBackdrop(svg, globe, mode) {
  const defs = svg.append("defs");

  const fillGradientId = safeId("map_globe_fill");
  const shadowGradientId = safeId("map_globe_shadow");

  const fillGradient = defs.append("radialGradient")
    .attr("id", fillGradientId)
    .attr("cx", "36%")
    .attr("cy", "28%")
    .attr("r", "74%");

  fillGradient.append("stop").attr("offset", "0%").attr("stop-color", "#e8f2ff").attr("stop-opacity", 0.95);
  fillGradient.append("stop").attr("offset", "50%").attr("stop-color", "#8fb4d9").attr("stop-opacity", 0.98);
  fillGradient.append("stop").attr("offset", "100%").attr("stop-color", "#123055").attr("stop-opacity", 1);

  const shadowGradient = defs.append("radialGradient")
    .attr("id", shadowGradientId)
    .attr("cx", "54%")
    .attr("cy", "58%")
    .attr("r", "74%");

  shadowGradient.append("stop").attr("offset", "0%").attr("stop-color", "#0f172a").attr("stop-opacity", 0);
  shadowGradient.append("stop").attr("offset", "58%").attr("stop-color", "#0f172a").attr("stop-opacity", 0.1);
  shadowGradient.append("stop").attr("offset", "100%").attr("stop-color", "#0f172a").attr("stop-opacity", 0.34);

  const backdrop = svg.append("g")
    .attr("class", "map-backdrop")
    .attr("pointer-events", "none");

  backdrop.append("circle")
    .attr("class", "map-sphere-shadow")
    .attr("cx", globe.center[0] + 10)
    .attr("cy", globe.center[1] + 12)
    .attr("r", globe.radius * 1.01)
    .style("fill", `url(#${shadowGradientId})`)
    .style("opacity", mode === PROJECTION_MODE_FLAT ? 0.18 : 0.34);

  backdrop.append("circle")
    .attr("class", "map-sphere")
    .attr("cx", globe.center[0])
    .attr("cy", globe.center[1])
    .attr("r", globe.radius)
    .style("fill", `url(#${fillGradientId})`)
    .style("opacity", 1)
    .style("filter", mode === PROJECTION_MODE_FLAT ? "none" : "drop-shadow(0 10px 18px rgba(15, 23, 42, 0.18))");

  backdrop.append("circle")
    .attr("class", "map-sphere-rim")
    .attr("cx", globe.center[0])
    .attr("cy", globe.center[1])
    .attr("r", globe.radius)
    .style("fill", "none")
    .style("stroke", mode === PROJECTION_MODE_FLAT ? "rgba(71, 85, 105, 0.18)" : "rgba(15, 23, 42, 0.38)")
    .style("stroke-width", mode === PROJECTION_MODE_FLAT ? 1 : 1.2)
    .style("opacity", mode === PROJECTION_MODE_FLAT ? 0.4 : 0.85);

  if (mode !== PROJECTION_MODE_FLAT) {
    const clipId = safeId("map_globe_clip");
    const clipPath = defs.append("clipPath")
      .attr("id", clipId)
      .attr("clipPathUnits", "userSpaceOnUse");

    clipPath.append("circle")
      .attr("cx", globe.center[0])
      .attr("cy", globe.center[1])
      .attr("r", globe.radius);

    return {
      clipPathId: clipId,
      backdrop
    };
  }

  return {
    clipPathId: null,
    backdrop
  };
}

const flagDisplayNames = typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
  ? new Intl.DisplayNames(["en"], { type: "region" })
  : null;

const isoCodeOverrides = new Map([
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

function resolveIsoCode(countryName) {
  const normalizedName = normalizeCountryLookupName(countryName);

  if (!normalizedName) {
    return null;
  }

  const override = isoCodeOverrides.get(normalizedName);
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
  const isoCode = resolveIsoCode(normalizedName);

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
      isoCode,
      flagEmoji: flagEmojiFromCountryCode(isoCode)
    }
  };
}

function adoptRuntimeCountryFeature(ctx, feature) {
  const properties = feature?.properties ?? {};

  if (typeof properties.name === "string" && properties.name.trim()) {
    // Ensure legacy data without an explicit `playable` property gets a
    // sensible default derived from `EXCLUDED`.
    if (typeof properties.playable === "boolean") {
      return feature;
    }

    return {
      ...feature,
      properties: {
        ...properties,
        playable: !Boolean(properties.EXCLUDED)
      }
    };
  }

  return normalizeCountryFeature(ctx, feature);
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
  const { name, playable } = feature.properties ?? {};
  // If `playable` is explicitly provided, use it. Otherwise, fall back to
  // the legacy `EXCLUDED` flag (playable = !EXCLUDED).
  return Boolean(name) && (typeof playable === "boolean" ? Boolean(playable) : !feature.properties?.EXCLUDED);
}

function getCountryKey(feature) {
  return String(feature?.properties?.name ?? "").trim().toLowerCase();
}

function getRenderableFeature(ctx, feature) {
  const keyedFeature = ctx.renderFeatureByName.get(getCountryKey(feature));
  return keyedFeature || feature;
}

function focusGlobeOnFeature(ctx, country) {
  if (ctx.mapProjectionMode === PROJECTION_MODE_FLAT) {
    return;
  }

  // If we are currently in transient polar azimuthal view, exit it first
  // so we can apply a rotation to the underlying globe projection and
  // then re-render. This prevents focus/zoom from being trapped in the
  // azimuthal projection.
  if (ctx._transientPolar) {
    try {
      disablePolarView();
    } catch (e) {
      if (ctx.debugMapInteractions) console.error('failed to disable polar view before focusing', e);
    }
  }

  const renderableCountry = getRenderableFeature(ctx, country);
  const centroid = ctx.d3.geoCentroid(renderableCountry);

  if (!Array.isArray(centroid) || !Number.isFinite(centroid[0]) || !Number.isFinite(centroid[1])) {
    return;
  }

  applyRotationToProjection(ctx, -centroid[0], -centroid[1]);

  // Re-render using the existing renderCountries handler which will
  // perform any projection-specific updates (including the polar
  // auto-switch when running inside the createWorldMap scope).
  if (typeof ctx.renderCountries === "function") {
    ctx.renderCountries();
  }
  // If rotation changed, consider switching to or from the polar azimuthal
  // projection so longitudes around the pole become visible.
  try {
    if (typeof maybeTogglePolarView === "function") {
      maybeTogglePolarView();
    }
  } catch (e) {
    if (ctx.debugMapInteractions) console.error('maybeTogglePolarView call failed', e);
  }
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

// Data Loading: Load country data, render, and filter
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
  let allFeatures = data.features.map((feature) => adoptRuntimeCountryFeature(ctx, feature));

  // If Antarctica is missing from the primary data, try to load it from a
  // backup GeoJSON file (useful during debugging). Do this non-fatally.
  const hasAnt = allFeatures.some((f) => getCountryKey(f) === "antarctica");
  if (!hasAnt) {
    try {
      const backupUrl = ctx.countriesGeoJsonUrl + ".backup2";
      const backupData = await ctx.d3.json(backupUrl);
      if (backupData && Array.isArray(backupData.features)) {
        const antFeature = backupData.features
          .map((feature) => adoptRuntimeCountryFeature(ctx, feature))
          .find((f) => getCountryKey(f) === "antarctica");
        if (antFeature) {
          allFeatures.push(antFeature);
          console.info("Added Antarctica from backup for debug drawing.");
        }
      }
    } catch (err) {
      // ignore if backup not found or parsing fails
      if (ctx.debugMapInteractions) console.warn("failed to load antarctica backup:", err);
    }
  }

  // Playable countries (used for game state and lists)
  const playableCountries = allFeatures.filter(isPlayableCountry);

  // Debug-only features to draw but not include in gameplay (e.g. Antarctica)
  const debugDrawExtras = allFeatures.filter((f) => getCountryKey(f) === "antarctica");

  // Keep internal country data limited to playable countries
  ctx.allCountriesData = playableCountries;
  ctx.renderFeatureByName = buildRenderableMapForContinent(ctx, null);

  const countryNames = playableCountries
    .map((country) => country.properties.name)
    .sort();
  const countryByName = new Map(
    playableCountries
      .map((country) => [country.properties.name.toLowerCase(), country])
  );

  // Bind paths: include playable countries plus any debug-only extras to draw
  const renderBind = playableCountries.concat(debugDrawExtras);

  ctx.g.selectAll("path")
    .data(renderBind)
    .enter()
    .append("path")
    .attr("d", ctx.path)
    .attr("class", (country) => "country" + (country?.properties?.playable === false ? " excluded" : ""))
    .attr("id", (country) => safeId(country.properties.name))
    .attr("vector-effect", "non-scaling-stroke")
    .style("pointer-events", (country) => country?.properties?.playable === false ? "none" : null);

  applyContinentVisibilityFilter(ctx);

  return { countriesData: playableCountries, countryNames, countryByName };
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
  focusGlobeOnFeature(ctx, country);
  // Attempt to add the `target` class to the country path. If the
  // map hasn't finished rendering paths yet, retry a few times with
  // short delays so the initial round selection still highlights.
  const tryMark = (attemptsLeft = 6) => {
    try {
      const sel = ctx.g.select("#" + safeId(String(country?.properties?.displayName ?? country?.properties?.name ?? country ?? "")));
      if (!sel || sel.empty()) {
        if (attemptsLeft > 0) {
          setTimeout(() => tryMark(attemptsLeft - 1), 80);
        }
        return;
      }
      sel.classed("target", true).style("fill", getComputedStyle(document.documentElement).getPropertyValue('--halo-color') || '#f2c95c');
    } catch (e) {
      if (attemptsLeft > 0) setTimeout(() => tryMark(attemptsLeft - 1), 80);
    }
  };
  tryMark();
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
  const projectedEast = resolveProjectionPoint(ctx, [180, 0]);
  const projectedWest = resolveProjectionPoint(ctx, [-180, 0]);
  const projectedOrigin = resolveProjectionPoint(ctx, [0, 0]);
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
  focusGlobeOnFeature(ctx, country);
  // If countries haven't been loaded/rendered yet, retry zoom until
  // rendering is ready (small retry loop to avoid race with initial load).
  if (!Array.isArray(ctx.allCountriesData) || ctx.allCountriesData.length === 0) {
    let attempts = 6;
    const retry = () => {
      attempts -= 1;
      if (Array.isArray(ctx.allCountriesData) && ctx.allCountriesData.length > 0) {
        zoomToCountry(ctx, country);
        return;
      }
      if (attempts > 0) setTimeout(retry, 80);
    };
    setTimeout(retry, 80);
    return;
  }
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
  mapProjectionMode = DEFAULT_PROJECTION_MODE,
  countriesGeoJsonUrl,
  countryNameProperty = "name",
  countryContinentProperty = "continent",
  countryContinentMemberships = new Map(),
  panSensitivityX = DEFAULT_PAN_SENSITIVITY_X,
  panSensitivityY = DEFAULT_PAN_SENSITIVITY_Y,
  debugMapInteractions = DEBUG_MAP_INTERACTIONS,
  projectionCameraDistance,
  maxLatitude = MAX_LATITUDE
}) {
  const svg = d3.select(selector);
  const { actualWidth, actualHeight } = getSvgDimensions({ svg, width, height });
  const projectionMode = normalizeProjectionMode(mapProjectionMode);
  const globe = projectionMode === PROJECTION_MODE_FLAT
    ? {
        center: [actualWidth / 2, actualHeight / 2],
        radius: Math.min(actualWidth, actualHeight) * 0.42
      }
    : createPerspectiveGlobeProjection({ actualWidth, actualHeight, mode: projectionMode, cameraDistance: projectionCameraDistance });
  const projection = projectionMode === PROJECTION_MODE_FLAT
    ? d3.geoNaturalEarth1().scale(160).translate([actualWidth / 2, actualHeight / 2])
    : globe;
  const path = projectionMode === PROJECTION_MODE_FLAT
    ? d3.geoPath(projection)
    : createPerspectivePathGenerator(globe);
  const frame = createMapBackdrop(svg, globe, projectionMode);
  const mapLayer = svg.append("g")
    .attr("class", "map-layer")
    .attr("clip-path", frame.clipPathId ? `url(#${frame.clipPathId})` : null);
  const g = mapLayer.append("g")
    .attr("class", "countries-layer");

  // Overlay group for polar azimuthal rendering (drawn on top of main map)
  const overlayGroup = mapLayer.append("g")
    .attr("class", "polar-overlay")
    .attr("pointer-events", "none")
    .attr("clip-path", frame.clipPathId ? `url(#${frame.clipPathId})` : null);

  const ctx = {
    d3,
    svg,
    width,
    height,
    mapProjectionMode: projectionMode,
    countriesGeoJsonUrl,
    countryNameProperty,
    countryContinentProperty,
    countryContinentMemberships,
    g,
    projection,
    path,
    backdrop: frame.backdrop,
    activeContinentFilter: null,
    allCountriesData: [],
    renderFeatureByName: new Map(),
    geometryFilter: null,
    renderCountries: null,
    zoom: null
  };

  // runtime tuning
  ctx.panSensitivityX = Number(panSensitivityX) || DEFAULT_PAN_SENSITIVITY_X;
  ctx.panSensitivityY = Number(panSensitivityY) || DEFAULT_PAN_SENSITIVITY_Y;
  ctx.debugMapInteractions = Boolean(debugMapInteractions);
  ctx.maxLatitude = Number(maxLatitude) || MAX_LATITUDE;
  // ensure last transform exists before zoom handler runs
  ctx._lastZoomTransform = d3.zoomIdentity;

  ctx.renderCountries = () => {
    ctx.g.selectAll(".country")
      .attr("d", (country) => ctx.path(getRenderableFeature(ctx, country)));
    // Render any polar overlay (non-destructive) and update debug info
    renderPolarOverlay();
    updateDebugOverlay();
  };

  // Render a non-destructive azimuthal overlay for pole-near features.
  function renderPolarOverlay() {
    try {
      // Clear overlay if no data
      if (!overlayGroup || !Array.isArray(ctx.allCountriesData) || ctx.allCountriesData.length === 0) {
        if (overlayGroup) overlayGroup.selectAll('*').remove();
        return;
      }

      const rot = getProjectionRotation(ctx);
      const lon = Number.isFinite(rot[0]) ? rot[0] : (Number.isFinite(ctx._rawLongitude) ? ctx._rawLongitude : 0);
      const lat = Number.isFinite(rot[1]) ? rot[1] : 0;
      const absLat = Math.abs(lat);

      // Only show overlay when near pole (use same threshold as toggle)
      if (absLat < POLAR_SWITCH_LAT) {
        overlayGroup.selectAll('*').remove();
        return;
      }

      const pole = lat > 0 ? 'north' : 'south';
      const dims = getSvgDimensions(ctx);
      const globeRadius = Math.min(dims.actualWidth, dims.actualHeight) * 0.41;

      const polarProj = ctx.d3.geoAzimuthalEqualArea()
        .translate([dims.actualWidth / 2, dims.actualHeight / 2])
        .rotate([-lon, pole === 'north' ? -90 : 90])
        .scale(Math.max(10, globeRadius));

      const polarPath = ctx.d3.geoPath(polarProj);

      // Select features with centroids near the pole to render in overlay
      const overlayThreshold = POLAR_SWITCH_LAT - POLAR_SWITCH_HYST;
      const candidates = (ctx.allCountriesData || []).filter((f) => {
        const renderable = getRenderableFeature(ctx, f);
        const cent = ctx.d3.geoCentroid(renderable);
        return Array.isArray(cent) && Number.isFinite(cent[1]) && ((pole === 'north' && cent[1] >= overlayThreshold) || (pole === 'south' && cent[1] <= -overlayThreshold));
      });

      // Data-join overlay paths
      const paths = overlayGroup.selectAll('path.polar-country').data(candidates, (d) => getCountryKey(d));

      paths.exit().remove();

      paths.enter()
        .append('path')
        // Give overlayed paths the same `country` base class so they inherit
        // existing CSS styling, plus `polar-country` for any overlay-specific rules.
        .attr('class', (d) => `country polar-country`)
        .attr('vector-effect', 'non-scaling-stroke')
        .style('pointer-events', 'none')
        .merge(paths)
        .attr('d', (d) => polarPath(getRenderableFeature(ctx, d)));
    } catch (e) {
      if (ctx.debugMapInteractions) console.error('renderPolarOverlay failed', e);
      if (overlayGroup) overlayGroup.selectAll('*').remove();
    }
  }

  // Automatic transient polar azimuthal projection support.
  // Switch to a d3 azimuthal projection when the user pans near a pole
  // so all longitudes around the pole are visible simultaneously.
  // Start transitioning to azimuthal polar view closer to mid-latitudes
  // so users see a smooth transition in/out (e.g. around ±45°).
  const POLAR_SWITCH_LAT = 45; // degrees latitude to enter polar view
  const POLAR_SWITCH_HYST = 6; // hysteresis degrees to avoid flicker
  const POLAR_TOGGLE_DEBOUNCE_MS = 200; // debounce to avoid flips during quick drags

  function createPolarAzimuthalProjection(actualWidth, actualHeight, pole = "north", centerLon = 0) {
    // Use azimuthal equal-area centered on the pole.
    const cx = actualWidth / 2;
    const cy = actualHeight / 2;
    // Estimate a scale to roughly match the globe radius used elsewhere.
    const globeRadius = Math.min(actualWidth, actualHeight) * 0.41;
    const proj = ctx.d3.geoAzimuthalEqualArea()
      .translate([cx, cy])
      // Use D3's convention to center the requested pole: north -> -90,
      // south -> 90. This ensures the azimuthal projection looks outward
      // from the pole rather than showing the opposite hemisphere.
      .rotate([-centerLon, pole === "north" ? -90 : 90])
      .scale(Math.max(10, globeRadius));

    const pathFn = ctx.d3.geoPath(proj);

    return { projection: proj, path: pathFn };
  }

  function enablePolarView(centerLon, pole = "north") {
    if (ctx._transientPolar) return;
    const dims = getSvgDimensions(ctx);
    const polar = createPolarAzimuthalProjection(dims.actualWidth, dims.actualHeight, pole, centerLon);
    // Save current projection/path so we can restore later
    ctx._savedProjection = { projection: ctx.projection, path: ctx.path };
    ctx.projection = polar.projection;
    ctx.path = polar.path;
    // Persist raw longitude so panning while in azimuthal view updates
    // the underlying globe orientation and doesn't get lost on restore.
    ctx._rawLongitude = Number.isFinite(Number(centerLon)) ? Number(centerLon) : 0;
    ctx._transientPolar = { pole, centerLon };
    if (ctx.debugMapInteractions) console.debug("entering polar view", { pole, centerLon });
    updatePolarIndicator(true, pole);
    if (typeof ctx.renderCountries === "function") ctx.renderCountries();
  }

  function disablePolarView() {
    if (!ctx._transientPolar) return;
    const saved = ctx._savedProjection || {};
    // Capture the pole before we clear transient state
    const pole = ctx._transientPolar?.pole;

    if (saved.projection && saved.path) {
      // Restore the saved projection/path first
      ctx.projection = saved.projection;
      ctx.path = saved.path;

      try {
        // Restore orientation: update the saved projection's longitude to the
        // user's last azimuthal center (`ctx._rawLongitude`) but nudge the
        // latitude slightly below the polar-switch exit threshold so we do
        // not immediately re-enter azimuthal mode.
        const rawLon = Number.isFinite(ctx._rawLongitude) ? ctx._rawLongitude : (saved.projection.rotation?.longitude ?? 0);
        const normLon = ((rawLon + 180) % 360 + 360) % 360 - 180;

        // Compute a safe exit latitude just inside the non-polar regime
        const exitLatThreshold = Math.max(0, POLAR_SWITCH_LAT - POLAR_SWITCH_HYST - 0.1);
        const sign = pole === "north" ? 1 : -1;
        const exitLat = sign * exitLatThreshold;

        if (saved.projection.rotation) {
          // Update longitude and nudge latitude to allow exiting polar view
          saved.projection.rotation.longitude = normLon;
          saved.projection.rotation.latitude = exitLat;
        } else {
          // Fallback: use helper to apply rotation if needed
          applyRotationToProjection(ctx, rawLon, exitLat);
        }
      } catch (e) {
        if (ctx.debugMapInteractions) console.error('failed to reapply rotation on disablePolarView', e);
      }
    }

    if (ctx.debugMapInteractions) console.debug("exiting polar view");
    ctx._transientPolar = null;
    ctx._savedProjection = null;
    updatePolarIndicator(false);
    if (typeof ctx.renderCountries === "function") ctx.renderCountries();
  }

  // Non-destructive polar overlay helpers. These do not replace the
  // canonical projection; they only toggle a rendering overlay drawn on
  // top of the main map to visualize pole-near geometry without moving
  // the underlying projection.
  function enablePolarOverlay(centerLon, pole = "north") {
    ctx._polarOverlayActive = { pole, centerLon };
    // Persist the user's longitude so overlay rotation matches panning
    ctx._rawLongitude = Number.isFinite(Number(centerLon)) ? Number(centerLon) : (ctx._rawLongitude || 0);
    renderPolarOverlay();
    updatePolarIndicator(true, pole);
  }

  function disablePolarOverlay() {
    ctx._polarOverlayActive = null;
    renderPolarOverlay();
    updatePolarIndicator(false);
  }

  function updatePolarIndicator(active, pole) {
    try {
      const el = document.getElementById('map-debug-overlay');
      if (!el) return;
      let badge = el.querySelector('#map-polar-indicator');
      if (active) {
        if (!badge) {
          badge = document.createElement('div');
          badge.id = 'map-polar-indicator';
          badge.style.fontSize = '11px';
          badge.style.padding = '4px 6px';
          badge.style.borderRadius = '4px';
          badge.style.background = 'rgba(255,255,255,0.06)';
          badge.style.color = '#d1fae5';
          badge.style.marginTop = '6px';
          el.appendChild(badge);
        }
        badge.textContent = `Polar view: ${pole || 'north'}`;
      } else if (badge) {
        badge.remove();
      }
    } catch (e) {
      if (ctx.debugMapInteractions) console.error('updatePolarIndicator failed', e);
    }
  }

  function maybeTogglePolarView() {
    try {
      // Only consider toggling for non-flat map modes
      if (ctx.mapProjectionMode === PROJECTION_MODE_FLAT) return;

      // Read rotation via adapter (normalizes both projection styles)
      const rot = getProjectionRotation(ctx);
      const centerLon = Number.isFinite(rot[0]) ? rot[0] : (Number(ctx._rawLongitude) || 0);
      const lat = Number.isFinite(rot[1]) ? rot[1] : NaN;
      if (!Number.isFinite(lat)) return;

      const absLat = Math.abs(lat);

      // Debounce toggling so quick drags don't flip modes mid-drag.
      if (ctx._polarToggleTimer) {
        clearTimeout(ctx._polarToggleTimer);
        ctx._polarToggleTimer = null;
      }

      // If overlay approach is used, toggle overlay instead of swapping
      // the main projection. This avoids replacing the projection and
      // prevents the sudden lat=±90 values returned by D3 azimuthal
      // projections' rotate() getter.
      if (!ctx._polarOverlayActive && absLat >= POLAR_SWITCH_LAT) {
        ctx._polarToggleTimer = setTimeout(() => {
          enablePolarOverlay(centerLon, lat > 0 ? 'north' : 'south');
        }, POLAR_TOGGLE_DEBOUNCE_MS);
        return;
      }

      if (ctx._polarOverlayActive) {
        // Schedule exit when latitude drops sufficiently below threshold.
        if (absLat <= (POLAR_SWITCH_LAT - POLAR_SWITCH_HYST)) {
          ctx._polarToggleTimer = setTimeout(() => {
            disablePolarOverlay();
          }, POLAR_TOGGLE_DEBOUNCE_MS);
        } else {
          // while overlay is active, keep overlay rotation in sync with
          // the canonical longitude so it follows panning.
          const currentLon = Number.isFinite(centerLon) ? centerLon : (ctx._polarOverlayActive.centerLon || 0);
          ctx._rawLongitude = currentLon;
          // Re-render overlay with updated longitude
          renderPolarOverlay();
        }
      }
    } catch (e) {
      if (ctx.debugMapInteractions) console.error("maybeTogglePolarView error", e);
    }
  }

  ctx.zoom = d3.zoom()
    .scaleExtent([1, 100])
    .on("zoom", (event) => {
      if (ctx.debugMapInteractions) {
        console.debug("zoom event", event && event.transform);
      }
      const t = event.transform;

      // Flat projection: apply regular SVG transform
      if (ctx.mapProjectionMode === PROJECTION_MODE_FLAT) {
        ctx.g.attr("transform", t.toString());
        ctx._lastZoomTransform = t;
        return;
      }

      // For perspective globe projections, interpret pan as rotation
      try {
        const last = ctx._lastZoomTransform || d3.zoomIdentity;
        const dx = t.x - last.x;
        const dy = t.y - last.y;

        // Compute a stable pixels->degrees mapping using SVG dimensions.
        // Using projected world width proved fragile when projection points
        // collapsed to nearly-equal screen x values; fall back to the
        // SVG width/height which gives consistent control for user drags.
        const dims = getSvgDimensions(ctx);
        const degreesPerPixelX = 360 / Math.max(1, dims.actualWidth || ctx.width || 1);
        // Invert horizontal pan so the map moves opposite the drag (skeuomorphic)
        let deltaLon = dx * degreesPerPixelX * ctx.panSensitivityX;

        // Vertical mapping: map full height to 180 degrees (lat range)
        const pixelsPerDegreeY = Math.max(1, (dims.actualHeight || ctx.height || 1) / 180);

        // IMPORTANT: BELOW: DO NOT REMOVE THE INVERSION OF THE VERTICAL DELTA! 
        // This is required to maintain a natural drag direction where dragging 
        // up moves the map down (north), and dragging down moves the map up (south). 
        // Removing this inversion will cause the map to move in the same direction 
        // as the drag, which is counterintuitive for map interactions.

        // Invert vertical pan so the map moves opposite the drag
        let deltaLat = -dy * (1 / pixelsPerDegreeY) * ctx.panSensitivityY;

          // Apply deltas to rotation, clamp latitude to avoid pole singularity
          const prevRawLon = Number.isFinite(ctx._rawLongitude) ? Number(ctx._rawLongitude) : Number(ctx.projection?.rotation?.longitude || 0);
          const prevNormLon = Number(ctx.projection?.rotation?.longitude || 0);
          const prevLat = Number(ctx.projection?.rotation?.latitude || 0);
          let newRawLon = prevRawLon + deltaLon;
          let newLat = prevLat + deltaLat;

          // Apply rotation using canonical helper (clamps latitude,
          // normalizes longitude). The helper will persist the raw
          // unwrapped longitude so wrap-around doesn't flip geometry.
          applyRotationToProjection(ctx, newRawLon, newLat);

          if (ctx.debugMapInteractions) {
            console.debug("map pan", {
              dx,
              dy,
              svgWidth: dims.actualWidth,
              degreesPerPixelX,
              deltaLon,
              deltaLat,
              prevRawLon,
              prevNormLon,
              newRawLon,
              normalizedLon: ctx.projection && ctx.projection.rotation ? ctx.projection.rotation.longitude : undefined,
              newLat
            });
            if (ctx.projection && ctx.projection.rotation && ctx.projection.rotation.longitude === prevNormLon) {
              console.debug("map pan: longitude unchanged (blocked)");
            }
          }

          if (typeof ctx.renderCountries === "function") {
            ctx.renderCountries();
          }
          // After rendering, check whether we should toggle the polar view.
          try {
            if (typeof maybeTogglePolarView === "function") maybeTogglePolarView();
          } catch (e) {
            if (ctx.debugMapInteractions) console.error('maybeTogglePolarView call failed', e);
          }

          ctx._lastZoomTransform = t;
          updateDebugOverlay();
          return;
      } catch (err) {
        if (ctx.debugMapInteractions) {
          console.error("map zoom handler error", err);
        }
        // Do not apply SVG transform for perspective projection on error;
        // just record the last transform so future deltas are computed.
        ctx._lastZoomTransform = t;
        updateDebugOverlay();
        return;
      }

      // Fallback: for flat projection apply transform, for perspective do not
      if (ctx.mapProjectionMode === PROJECTION_MODE_FLAT) {
        ctx.g.attr("transform", t.toString());
      } else {
        // Record the last transform but don't pan the SVG group off the globe
        ctx._lastZoomTransform = t;
        updateDebugOverlay();
      }
    });

  svg.call(ctx.zoom);

  // initialize last transform so first drag computes deltas correctly
  ctx._lastZoomTransform = d3.zoomIdentity;

  // Allow manual escape of polar mode for testing/tuning
  try {
    window.addEventListener('keydown', (ev) => {
      if (!ev) return;
      if (ev.key === 'Escape' || ev.key === 'Esc') {
        try {
          disablePolarView();
        } catch (e) {
          if (ctx.debugMapInteractions) console.error('escape: disablePolarView failed', e);
        }
      }
    });
  } catch (e) {
    // ignore in environments without `window`
  }

  // Debug overlay (when enabled) to show rotation and last deltas
  function createDebugOverlay() {
    const id = "map-debug-overlay";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.style.position = "fixed";
      el.style.right = "8px";
      el.style.top = "8px";
      el.style.zIndex = "10000";
      el.style.background = "rgba(0,0,0,0.6)";
      el.style.color = "#fff";
      el.style.fontSize = "12px";
      el.style.padding = "8px";
      el.style.borderRadius = "6px";
      el.style.lineHeight = "1.2";
      el.style.pointerEvents = "none";
      document.body.appendChild(el);
    }

    // If debug interactions are enabled, add interactive controls that
    // allow tuning the perspective camera distance at runtime.
    if (!el._controlsInstalled) {
      el.style.pointerEvents = "auto";
      const ctrlWrap = document.createElement("div");
      ctrlWrap.style.display = "flex";
      ctrlWrap.style.flexDirection = "column";
      ctrlWrap.style.gap = "6px";

      const label = document.createElement("label");
      label.style.fontSize = "11px";
      label.style.opacity = "0.9";
      label.textContent = "Camera distance:";

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";

      const input = document.createElement("input");
      input.type = "range";
      input.id = "map-cam-distance";
      input.min = 1.0;
      input.max = 3.5;
      input.step = 0.1;
      input.style.width = "140px";
      input.value = (ctx.projection && ctx.projection.camera && ctx.projection.camera.positionZ) || 1.8;

      const valueTxt = document.createElement("span");
      valueTxt.id = "map-cam-distance-val";
      valueTxt.style.minWidth = "36px";
      valueTxt.style.textAlign = "right";
      valueTxt.textContent = input.value;

      row.appendChild(input);
      row.appendChild(valueTxt);

      const resetBtn = document.createElement("button");
      resetBtn.textContent = "Reset";
      resetBtn.style.fontSize = "11px";
      resetBtn.style.padding = "4px 6px";
      resetBtn.style.borderRadius = "4px";
      resetBtn.style.border = "none";
      resetBtn.style.cursor = "pointer";

      ctrlWrap.appendChild(label);
      ctrlWrap.appendChild(row);
      ctrlWrap.appendChild(resetBtn);

      el.appendChild(ctrlWrap);

      function applyCameraDistance(newVal) {
        const parsed = Number(newVal);
        if (!Number.isFinite(parsed)) return;

        // Recreate globe projection with new camera distance and update
        // the path generator so subsequent renders use the updated horizon.
        try {
          const dims = getSvgDimensions(ctx);
          const globe = createPerspectiveGlobeProjection({ actualWidth: dims.actualWidth, actualHeight: dims.actualHeight, mode: ctx.mapProjectionMode, cameraDistance: parsed });
          ctx.projection = globe;
          ctx.path = createPerspectivePathGenerator(globe);
          // Re-render countries with the new projection
          if (typeof ctx.renderCountries === "function") ctx.renderCountries();
        } catch (e) {
          console.error("failed to apply camera distance", e);
        }
      }

      input.addEventListener("input", (ev) => {
        const v = ev.target.value;
        valueTxt.textContent = v;
        applyCameraDistance(v);
      });

      resetBtn.addEventListener("click", () => {
        const defaultVal = 1.8;
        input.value = defaultVal;
        valueTxt.textContent = defaultVal;
        applyCameraDistance(defaultVal);
      });

      el._controlsInstalled = true;
    }

    return el;
  }

  function updateDebugOverlay() {
    if (!ctx.debugMapInteractions) return;
    const el = createDebugOverlay();
    // Read rotation via adapter for consistent display
    const rot = getProjectionRotation(ctx);
    const lon = Number.isFinite(rot[0]) ? rot[0] : "n/a";
    const lat = Number.isFinite(rot[1]) ? rot[1] : "n/a";
    const last = ctx._lastZoomTransform || { x: 0, y: 0, k: 1 };
    const text = [
      `lon: ${typeof lon === 'number' ? lon.toFixed(3) : lon}`,
      `lat: ${typeof lat === 'number' ? lat.toFixed(3) : lat}`,
      `t: x=${last.x.toFixed(1)} y=${last.y.toFixed(1)} k=${last.k?.toFixed(2) ?? "1"}`
    ].join("\n");
    // retain existing controls while updating rotation text; place above controls
    // if controls exist, update a text node; otherwise replace content.
    const existingControls = el.querySelector('div');
    if (existingControls) {
      // Ensure a status line exists
      let status = el.querySelector('.map-debug-status');
      if (!status) {
        status = document.createElement('pre');
        status.className = 'map-debug-status';
        status.style.margin = '0 0 6px 0';
        status.style.fontSize = '11px';
        status.style.opacity = '0.95';
        el.insertBefore(status, existingControls);
      }
      status.textContent = text;
    } else {
      el.textContent = text;
    }
  }

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
