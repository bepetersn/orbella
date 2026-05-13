/**
 * @fileoverview Factory for building a fully-stubbed window.worldleLiteRuntime.
 *
 * Call await buildRuntime(overrides) in a beforeEach to install a clean fake runtime
 * before loading or re-executing any IIFE under test.  Every slot that source
 * files read from the runtime is pre-populated with a vi.fn() stub so callers
 * never hit "cannot read property of undefined" errors.
 *
 * Usage:
 *   import { buildRuntime } from '../fixtures/runtime-builder.js';
 *   beforeEach(async () => { await buildRuntime(); });
 */

/**
 * Build and install a stubbed runtime on window.worldleLiteRuntime.
 *
 * @param {object} overrides - Deep-merged on top of the default stubs.
 * @returns {Promise<object>} The installed runtime object.
 */
export async function buildRuntime(overrides = {}) {
  const runtime = {
    BUILD_ID: 'test-build',

    config: {
      COPY: {},
      W: 800,
      H: 600,
      DEBUG: false,
      DEBUG_STORAGE_KEY: 'worldle_debug',
      MAX_MISSES_PER_ROUND: 5,
      MAX_HINTS_PER_ROUND: 3,
      ROUND_ADVANCE_MS: 3000,
      COUNTRIES_GEOJSON_URL: '/pipeline/data/generated/world-countries.render.json',
      COUNTRY_NAME_PROPERTY: 'ADMIN',
      COUNTRY_CONTINENT_PROPERTY: 'CONTINENT',
      COUNTRY_CONTINENT_MEMBERSHIPS: {},
      MAP_PAN_SENSITIVITY_X: 0.3,
      MAP_PAN_SENSITIVITY_Y: 0.3,
      MAP_DEBUG_INTERACTIONS: false,
      MAP_MAX_LATITUDE: 85,
      MAP_SELECTOR: '#globe',
      WRONG_MSG_CLASS: 'wrong',
      FAILURE_MSG_CLASS: 'failure',
      CORRECT_MSG_CLASS: 'correct',
      IS_VALID_CLASS: 'is-valid',
      GUESS_PILL_CLASS: 'guess-pill',
    },

    dom: {
      input: null,
      suggestionsBox: null,
      feedback: null,
      heroEyebrow: null,
      heroTitle: null,
      heroSubtitle: null,
      ruleMisses: null,
      ruleAutocomplete: null,
      ruleReveal: null,
      roundTransition: null,
      roundTransitionLabel: null,
      roundTransitionFill: null,
      revealPanel: null,
      guessListWrap: null,
      celebration: null,
      celebrationCard: null,
      celebrationTitle: null,
      celebrationText: null,
      confettiLayer: null,
      continentFilter: null,
      hintPanel: null,
      hintUsage: null,
      hintText: null,
      hintBtn: null,
      revealBtn: null,
      replayHaloBtn: null,
      nextRoundBtn: null,
      autoAdvanceToggle: null,
      autoAdvanceLabel: null,
      resetBtn: null,
      revealTarget: null,
      buildMarker: null,
      debugToggle: null,
      themeToggle: null,
      guessList: null,
      scoreCorrect: null,
      scorePlayed: null,
      hintsUsedInRound: null,
      totalHintsUsed: null,
    },

    state: {
      store: {},
      targetSelector: {
        pickTarget: vi.fn(),
        getCurrentTarget: vi.fn(),
        reset: vi.fn(),
      },
    },

    actions: {
      loadCountriesIntoState: vi.fn(),
      setSelectedIndex: vi.fn(),
      setTargetCountry: vi.fn(),
      showFirstRound: vi.fn(),
      incrementCorrect: vi.fn(),
      incrementPlayed: vi.fn(),
      incrementHintsUsed: vi.fn(),
      resetScores: vi.fn(),
      setSelectedContinent: vi.fn(),
      getRoundState: vi.fn(),
      startRound: vi.fn(),
      revealRoundAnswer: vi.fn(),
      requestRoundHint: vi.fn(),
      submitRoundGuess: vi.fn(),
      normalizeGuess: vi.fn(),
      resolveCountryGuess: vi.fn(),
      getSuggestedCountryNames: vi.fn(),
    },

    worldMapInst: null,

    autoAdvanceEnabled: true,
    autoAdvance: {
      isEnabled: vi.fn().mockReturnValue(true),
      setAutoAdvanceEnabled: vi.fn(),
    },

    timers: {
      schedule: vi.fn(),
      cancel: vi.fn(),
      cancelAll: vi.fn(),
      isActive: vi.fn().mockReturnValue(false),
    },

    roundUi: null,
    input: null,
    round: null,
  };

  // Apply overrides (shallow-merge each top-level key)
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      runtime[key] = { ...runtime[key], ...value };
    } else {
      runtime[key] = value;
    }
  }

  const { setRuntime } = await import('../../src/app/runtime.js');
  setRuntime(runtime);
  window.worldleLiteRuntime = runtime;
  return runtime;
}
