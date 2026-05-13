/**
 * @fileoverview Shared configuration for Worldle Lite.
 *
 * Tunable settings that control gameplay behavior: viewport dimensions,
 * interaction sensitivity, gameplay rules, data sources, and timing.
 */
export const gameConfig = {
  // Viewport and rendering
  W: 960,
  H: 500,
  MAP_PROJECTION_MODE: 'rounded',
  DEBUG: false,
  // Injected at build/dev time by Vite (vite.config.js define.__BUILD_ID__).
  // Falls back to empty string in test environments where Vite is not involved.
  BUILD_ID: typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : '', // eslint-disable-line no-undef
  // Content hash of the GeoJSON data file, injected by Vite at build time.
  // Changes only when the data file changes, so browsers re-fetch only then.
  GEOJSON_HASH: typeof __GEOJSON_HASH__ !== 'undefined' ? __GEOJSON_HASH__ : '', // eslint-disable-line no-undef

  // Map interaction
  MAP_PAN_SENSITIVITY_X: 1.0,
  MAP_PAN_SENSITIVITY_Y: 1.0,
  MAP_DEBUG_INTERACTIONS: false,
  MAP_MAX_LATITUDE: 89.0,

  // Storage keys
  DEBUG_STORAGE_KEY: 'worldle-lite-debug',
  AUTO_ADVANCE_STORAGE_KEY: 'worldle-lite-auto-advance',
  THEME_STORAGE_KEY: 'worldle-lite-theme',

  // Data sources and property mappings
  COUNTRIES_GEOJSON_URL: 'pipeline/data/generated/world-countries.render.json',
  COUNTRY_NAME_PROPERTY: 'NAME_EN',
  COUNTRY_CONTINENT_PROPERTY: 'CONTINENT',
  COUNTRY_CONTINENT_MEMBERSHIPS: new Map([['russia', ['Europe', 'Asia']]]),

  // Polygon parts to exclude from rendering and centroid calculations.
  // Each entry maps a lowercase country name to an array of bounding boxes
  // [minLon, minLat, maxLon, maxLat]. Any polygon part whose centroid falls
  // inside a box is stripped (e.g. French Guiana from France).
  COUNTRY_EXCLUDED_POLYGON_BOUNDS: new Map([
    ['france', [[-56, 1, -50, 7]]], // French Guiana
  ]),

  // Gameplay rules
  MAX_MISSES_PER_ROUND: 3,
  MAX_HINTS_PER_ROUND: 3,
  MAX_SUGGESTIONS: 6,

  // Round state transition timings (in milliseconds)
  ROUND_ADVANCE_MS: {
    correct: 2000,
    reveal: 2400,
    miss: 2600,
  },
};

// COPY is the single source of truth in constants.js; re-exported here so
// callers that reach for `gameConfig.COPY` (e.g. bootstrap) work without change.
export { COPY } from './constants.js';
