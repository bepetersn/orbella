/**
 * @fileoverview Shared runtime context assembled at startup.
 *
 * Collects all module references from `window.*`, extracts the config values
 * they need, creates the `targetSelector` instance, and
 * caches DOM element references.  The resulting object is written to
 * `window.worldleLiteRuntime` so every subsequent module can share a single
 * set of instances without importing them directly.
 */
(() => {
  const BUILD_ID = "2026-04-23-1";
  const IMPORTS = {
    gameStore: window.gameStore,
    targetSelector: window.targetSelector,
    audioFeedback: window.audioFeedback,
    themeSystem: window.themeSystem,
    worldMap: window.worldMap,
    d3: window.d3,
    gameConfig: window.gameConfig,
  };

  // Lightweight runtime logger that respects the UI debug toggle
  function _isDebugEnabled() {
    try {
      return Boolean(window.__WORLDLE_DEBUG__ ?? IMPORTS.gameConfig?.DEBUG);
    } catch {
      return Boolean(IMPORTS.gameConfig && IMPORTS.gameConfig.DEBUG);
    }
  }

  const worldleLiteLogger = {
    debug: (...args) => { if (_isDebugEnabled()) { (console.debug || console.log).apply(console, args); } },
    info: (...args) => { if (_isDebugEnabled()) { (console.info || console.log).apply(console, args); } },
    warn: (...args) => { (console.warn || console.log).apply(console, args); },
    error: (...args) => { (console.error || console.log).apply(console, args); },
    group: (...args) => { if (_isDebugEnabled() && console.group) console.group(...args); },
    groupEnd: () => { if (_isDebugEnabled() && console.groupEnd) console.groupEnd(); }
  };

  window.worldleLiteLogger = worldleLiteLogger;

  const {
    COPY,
    W,
    H,
    DEBUG,
    DEBUG_STORAGE_KEY,
    MAX_MISSES_PER_ROUND,
    MAX_HINTS_PER_ROUND,
    ROUND_ADVANCE_MS,
    COUNTRIES_GEOJSON_URL,
    COUNTRY_NAME_PROPERTY,
    COUNTRY_CONTINENT_PROPERTY,
    COUNTRY_CONTINENT_MEMBERSHIPS,
    MAP_PAN_SENSITIVITY_X,
    MAP_PAN_SENSITIVITY_Y,
    MAP_DEBUG_INTERACTIONS,
    MAP_MAX_LATITUDE
  } = IMPORTS.gameConfig;
  const gameStore = IMPORTS.gameStore;
  const targetSelector = IMPORTS.targetSelector.createTargetSelector();

  window.worldleLiteRuntime = {
    BUILD_ID,
    IMPORTS,
    config: {
      COPY,
      W,
      H,
      DEBUG,
      DEBUG_STORAGE_KEY,
      MAX_MISSES_PER_ROUND,
      MAX_HINTS_PER_ROUND,
      ROUND_ADVANCE_MS,
      COUNTRIES_GEOJSON_URL,
      COUNTRY_NAME_PROPERTY,
      COUNTRY_CONTINENT_PROPERTY,
      COUNTRY_CONTINENT_MEMBERSHIPS,
      MAP_PAN_SENSITIVITY_X,
      MAP_PAN_SENSITIVITY_Y,
      MAP_DEBUG_INTERACTIONS,
      MAP_MAX_LATITUDE,
      MAP_SELECTOR: "#globeViz",
      WRONG_MSG_CLASS: "wrong-msg",
      FAILURE_MSG_CLASS: "failure-msg",
      CORRECT_MSG_CLASS: "correct-msg",
      IS_VALID_CLASS: "is-valid",
      GUESS_PILL_CLASS: "guess-pill"
    },
    dom: {
      input: document.getElementById("guessInput"),
      suggestionsBox: document.getElementById("suggestions"),
      feedback: document.getElementById("feedback"),
      heroEyebrow: document.getElementById("hero-eyebrow"),
      heroTitle: document.getElementById("app-title"),
      heroSubtitle: document.getElementById("app-subtitle"),
      ruleMisses: document.getElementById("rule-misses"),
      ruleAutocomplete: document.getElementById("rule-autocomplete"),
      ruleReveal: document.getElementById("rule-reveal"),
      roundTransition: document.getElementById("round-transition"),
      roundTransitionLabel: document.getElementById("round-transition-label"),
      roundTransitionFill: document.getElementById("round-transition-fill"),
      revealPanel: document.getElementById("reveal-panel"),
      guessListWrap: document.getElementById("guess-list-wrap"),
      celebration: document.getElementById("celebration"),
      celebrationCard: document.getElementById("celebration-card"),
      celebrationTitle: document.getElementById("celebration-title"),
      celebrationText: document.getElementById("celebration-text"),
      confettiLayer: document.getElementById("confetti-layer"),
      continentFilter: document.getElementById("continent-filter"),
      hintPanel: document.getElementById("hint-panel"),
      hintUsage: document.getElementById("hint-usage"),
      hintText: document.getElementById("hint-text"),
      hintBtn: document.getElementById("btn-hint"),
      revealBtn: document.getElementById("btn-reveal"),
      replayHaloBtn: document.getElementById("btn-replay-halo"),
      nextRoundBtn: document.getElementById("btn-next-round"),
      autoAdvanceToggle: document.getElementById("auto-advance-toggle"),
      autoAdvanceLabel: document.getElementById("auto-advance-toggle-label"),
      resetBtn: document.getElementById("btn-reset"),
      revealTarget: document.getElementById("revealTarget"),
      buildMarker: document.getElementById("build-marker"),
      debugToggle: document.getElementById("debug-toggle"),
      themeToggle: document.getElementById("theme-toggle"),
      guessList: document.getElementById("guess-list"),
      scoreCorrect: document.getElementById("numCorrect"),
      scorePlayed: document.getElementById("numPlayed"),
      scoreHints: document.getElementById("numHintsUsed")
    },
    state: {
      store: gameStore.state,
      targetSelector
    },
    actions: {
      loadCountriesIntoState: gameStore.loadCountriesIntoState,
      setSelectedIndex: gameStore.setSelectedIndex,
      setTargetCountry: gameStore.setTargetCountry,
      showFirstRound: gameStore.showFirstRound,
      incrementCorrect: gameStore.incrementCorrect,
      incrementPlayed: gameStore.incrementPlayed,
      incrementHintsUsed: gameStore.incrementHintsUsed,
      resetScores: gameStore.resetScores,
      setSelectedContinent: gameStore.setSelectedContinent,
      getRoundState: gameStore.getRoundState,
      startRound: gameStore.startRound,
      revealRoundAnswer: gameStore.revealRoundAnswer,
      requestRoundHint: gameStore.requestRoundHint,
      submitRoundGuess: gameStore.submitRoundGuess,
      normalizeGuess: gameStore.normalizeGuess,
      resolveCountryGuess: gameStore.resolveCountryGuess,
      getSuggestedCountryNames: gameStore.getSuggestedCountryNames
    },
    worldMapInst: null,
    roundTransitionTimer: null,
    roundTransitionHideTimer: null,
    roundRevealTimer: null,
    celebrationTimer: null,
    input: null,
    round: null
  };
})();
