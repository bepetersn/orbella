/**
 * @fileoverview Target country selection with short-term anti-repetition.
 *
 * Creates a selector that shuffles eligible countries, keeps a rolling window
 * of recent targets, and persists selection history in `localStorage` between
 * sessions.
 *
 * Exported as {@link window.targetSelector}.
 */
(() => {
  // ---------------------------------------------------------------------------
  // Setup / defaults / utils
  // ---------------------------------------------------------------------------

  const DEFAULT_OPTIONS = {
    recentWindowSize: 8,
    storageKey: "worldle-lite-target-selector-v1"
  };

  function normalizeCountryName(country) {
    return String(country?.properties?.name ?? "").trim().toLowerCase();
  }


  // Selector state lifecycle
  // ---------------------------------------------------------------------------

  function createSelectorState(config) {
    return {
      config,
      roundCounter: 0,
      recentTargetNames: [],
      seenCountByName: new Map(),
      lastSeenRoundByName: new Map(),
      deckByPoolKey: new Map()
    };
  }

  function clearSelectionHistory(state) {
    state.roundCounter = 0;
    state.recentTargetNames = [];
    state.seenCountByName = new Map();
    state.lastSeenRoundByName = new Map();
  }

  // Persistence I/O & Helpers
  // ---------------------------------------------------------------------------

  function loadPersistedState(state) {
    try {
      const raw = window.localStorage.getItem(state.config.storageKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return;
      }

      state.recentTargetNames = parseNormalizedRecentTargets(
        parsed.recentTargetNames,
        state.config.recentWindowSize
      );
      state.seenCountByName = parseNormalizedNumericMap(parsed.seenCountByName);
      state.lastSeenRoundByName = parseNormalizedNumericMap(parsed.lastSeenRoundByName);
      state.roundCounter = Number(parsed.roundCounter) || 0;
    } catch {
      clearSelectionHistory(state);
    }
  }

  function persistState(state) {
    try {
      const payload = {
        roundCounter: state.roundCounter,
        recentTargetNames: state.recentTargetNames,
        seenCountByName: Object.fromEntries(state.seenCountByName),
        lastSeenRoundByName: Object.fromEntries(state.lastSeenRoundByName)
      };

      window.localStorage.setItem(state.config.storageKey, JSON.stringify(payload));
    } catch {
      // Intentionally ignore storage failures.
    }
  }

  function parseNormalizedRecentTargets(recentTargetNames, recentWindowSize) {
    if (!Array.isArray(recentTargetNames)) {
      return [];
    }

    return recentTargetNames
      .map((name) => String(name).trim().toLowerCase())
      .filter(Boolean)
      .slice(-recentWindowSize);
  }

  function parseNormalizedNumericMap(source) {
    if (!source || typeof source !== "object") {
      return new Map();
    }

    return new Map(
      Object.entries(source)
        .map(([name, value]) => [String(name).trim().toLowerCase(), Number(value) || 0])
        .filter(([name]) => Boolean(name))
    );
  }


  // Deck construction
  // ---------------------------------------------------------------------------

  function buildDeck(state, pool) {
    const normalizedPool = pool.filter((country) => Boolean(normalizeCountryName(country)));
    if (normalizedPool.length === 0) {
      return [];
    }

    const recentSet = new Set(state.recentTargetNames);
    const nonRecentPool = normalizedPool.filter((country) => !recentSet.has(normalizeCountryName(country)));
    const candidatePool = [...(nonRecentPool.length > 0 ? nonRecentPool : normalizedPool)];

    for (let index = candidatePool.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const tempCountry = candidatePool[index];
      candidatePool[index] = candidatePool[swapIndex];
      candidatePool[swapIndex] = tempCountry;
    }

    return candidatePool;
  }

  // Selection flow
  // ---------------------------------------------------------------------------

  function removeFromOtherDecks(state, countryName) {
    for (const [poolKey, deck] of state.deckByPoolKey) {
      const nextDeck = deck.filter((country) => normalizeCountryName(country) !== countryName);
      state.deckByPoolKey.set(poolKey, nextDeck);
    }
  }

  function rememberSelection(state, country) {
    const key = normalizeCountryName(country);
    if (!key) {
      return;
    }

    state.roundCounter += 1;
    state.seenCountByName.set(key, (state.seenCountByName.get(key) || 0) + 1);
    state.lastSeenRoundByName.set(key, state.roundCounter);

    state.recentTargetNames.push(key);
    if (state.recentTargetNames.length > state.config.recentWindowSize) {
      state.recentTargetNames = state.recentTargetNames.slice(-state.config.recentWindowSize);
    }

    removeFromOtherDecks(state, key);
    persistState(state);
  }

  function getNextTarget(state, pool, poolKey = "all") {
    // 1. Validate and normalize the incoming pool.
    const safePool = Array.isArray(pool) ? pool : [];
    if (safePool.length === 0) {
      return null;
    }

    // 2. Get an existing deck for this pool key, or rebuild one.
    const normalizedPoolKey = String(poolKey || "all");
    let deck = state.deckByPoolKey.get(normalizedPoolKey) || [];

    if (deck.length === 0) {
      deck = buildDeck(state, safePool);
    }

    // 3. Fallback to raw pool if filtering produced an empty deck.
    if (deck.length === 0) {
      deck = [...safePool];
    }

    // 4. Consume next target, persist deck, and remember selection history.
    const nextTarget = deck.shift() || null;
    state.deckByPoolKey.set(normalizedPoolKey, deck);

    if (nextTarget) {
      rememberSelection(state, nextTarget);
    }

    return nextTarget;
  }


  function reset(state) {
    clearSelectionHistory(state);
    state.deckByPoolKey = new Map();
    persistState(state);
  }

  
  // Public API
  // ---------------------------------------------------------------------------

  function createTargetSelector(options = {}) {
    const config = {
      ...DEFAULT_OPTIONS,
      ...options
    };

    const state = createSelectorState(config);
    loadPersistedState(state);

    return {
      getNextTarget: getNextTarget.bind(null, state),
      reset: reset.bind(null, state)
    };
  }

  window.targetSelector = {
    createTargetSelector
  };
})();
