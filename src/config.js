/**
 * @fileoverview Shared configuration for Worldle Lite.
 *
 * Tunable settings that control gameplay behavior: viewport dimensions,
 * interaction sensitivity, gameplay rules, data sources, and timing.
 *
 * Exposed globally as {@link window.gameConfig}.
 */
window.gameConfig = {
  // Viewport and rendering
  W: 960,
  H: 500,
  MAP_PROJECTION_MODE: "rounded",
  DEBUG: true,

  // Map interaction
  MAP_PAN_SENSITIVITY_X: 1.0,
  MAP_PAN_SENSITIVITY_Y: 1.0,
  MAP_DEBUG_INTERACTIONS: true,
  MAP_MAX_LATITUDE: 89.0,

  // Storage keys
  DEBUG_STORAGE_KEY: "worldle-lite-debug",
  AUTO_ADVANCE_STORAGE_KEY: "worldle-lite-auto-advance",
  THEME_STORAGE_KEY: "worldle-lite-theme",

  // Data sources and property mappings
  COUNTRIES_GEOJSON_URL: "pipeline/data/generated/world-countries.render.json",
  COUNTRY_NAME_PROPERTY: "NAME_EN",
  COUNTRY_CONTINENT_PROPERTY: "CONTINENT",
  COUNTRY_CONTINENT_MEMBERSHIPS: new Map([
    ["russia", ["Europe", "Asia"]]
  ]),

  // Polygon parts to exclude from rendering and centroid calculations.
  // Each entry maps a lowercase country name to an array of bounding boxes
  // [minLon, minLat, maxLon, maxLat]. Any polygon part whose centroid falls
  // inside a box is stripped (e.g. French Guiana from France).
  COUNTRY_EXCLUDED_POLYGON_BOUNDS: new Map([
    ["france", [[-56, 1, -50, 7]]]  // French Guiana
  ]),

  // UI copy strings
  COPY: {
    pageTitle: "Worldle Lite",
    hero: {
      title: "Worldle Lite",
      subtitle: "Guess the country highlighted on the map. Each round gives you three distinct misses, and revealing the answer leaves the round revealed until you start a new game."
    },
    buttons: {
      showAnswer: "Show Answer",
      nextRound: "Next Country",
      hint: "Hint"
    },
    feedback: {
      correct: "Correct! 🎉",
      outOfGuesses: "Out of guesses.",
      answerShown: "Better luck next time!",
      wrongPrefix: "Not quite — ",
      wrongSuffix: " guess(es) left."
    },
    input: {
      idlePlaceholder: "Type a country name…",
      lockedPlaceholder: "Round over"
    },
    reveal: {
      answerPrefix: "The answer was: "
    },
    transitions: {
      loadingNextCountry: "Loading next country…"
    },
    hints: {
      flag: "Flag: {flag}",
      firstLetter: "Starts with: {letter}",
      letterCount: "Letters: {count}",
      separator: " · "
    }
  },

  // Gameplay rules
  MAX_MISSES_PER_ROUND: 3,
  MAX_HINTS_PER_ROUND: 3,
  MAX_SUGGESTIONS: 6,

  // Round state transition timings (in milliseconds)
  ROUND_ADVANCE_MS: {
    correct: 2000,
    reveal: 2400,
    miss: 2600
  }
};
