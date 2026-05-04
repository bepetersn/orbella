/**
 * @fileoverview Round flow control – guess submission, win/loss handling,
 * reveal, and new-round start.
 *
 * Coordinates store round actions, `worldMapInst`, `audioFeedback`, `roundUi`,
 * and `roundTransitions` to drive the full round lifecycle.
 *
 * Attaches itself to `runtime.roundControl`.
 */
(() => {
  const runtime = window.worldleLiteRuntime;
  const { dom, state, config, actions, IMPORTS } = runtime;
  const ROUND_OUTCOME = IMPORTS.gameStore.ROUND_OUTCOME;
  const solvedCountriesByRegion = new Map();
  const celebratedRegions = new Set();

  function getRegionKey() {
    return state.store.selectedContinent || "all";
  }

  function getRegionLabel() {
    return state.store.selectedContinent || "the world";
  }

  function getEligibleCountriesForRegion() {
    if (!state.store.selectedContinent) {
      return state.store.countriesData;
    }

    return state.store.countriesData.filter((country) => (
      runtime.input.isCountryInSelectedContinent(country, state.store.selectedContinent)
    ));
  }

  function registerSolvedCountry(match) {
    const countryName = match?.properties?.displayName ?? match?.properties?.name;
    if (!countryName) {
      return false;
    }

    const regionKey = getRegionKey();
    const solvedSet = solvedCountriesByRegion.get(regionKey) || new Set();
    solvedSet.add(actions.normalizeGuess(countryName));
    solvedCountriesByRegion.set(regionKey, solvedSet);

    const eligibleCountryCount = getEligibleCountriesForRegion().length;
    if (!eligibleCountryCount || solvedSet.size < eligibleCountryCount || celebratedRegions.has(regionKey)) {
      return false;
    }

    celebratedRegions.add(regionKey);
    runtime.roundUi.showCelebration(`You solved every country in ${getRegionLabel()}.`);
    return true;
  }

  /**
   * Conclude the current round: play audio feedback, update the score display,
   * show the feedback message, render the reveal panel, and optionally begin
   * the progress-bar transition to the next round.
   *
   * @param {object}  options
   * @param {string}  options.outcome          One of the `ROUND_OUTCOME` values.
   * @param {string}  options.message          Feedback text to display.
   * @param {string}  options.feedbackClass    CSS class for the feedback element.
   * @param {number}  options.advanceAfterMs   Delay in ms before starting the next round.
   * @param {string}  options.transitionLabel  Label shown on the progress bar.
   * @param {boolean} [options.autoAdvance]    If `false`, skip the transition timer.
   */
  function finishRound({ outcome, message, feedbackClass, advanceAfterMs, transitionLabel, autoAdvance = true }) {
    try { window.worldleLiteLogger?.info('[round] finishRound', { outcome, message, autoAdvance }); } catch (e) {}
    try { window.worldleLiteLogger?.debug('[round] finishRound - autoAdvance state', { runtimeAutoAdvanceEnabled: runtime.autoAdvanceEnabled, autoAdvanceIsEnabledFn: runtime.autoAdvance?.isEnabled?.() }); } catch (e) {}
    const { setFeedback, updateStats } = runtime.roundUi;
    const { beginRoundTransition, scrollStatusIntoView } = runtime.roundTransitions;
    const autoAdvanceEnabled = runtime.autoAdvance?.isEnabled?.() ?? true;

    if (outcome !== ROUND_OUTCOME.won) {
      runtime.IMPORTS.audioFeedback.loss();
    } else {
      runtime.IMPORTS.audioFeedback.correct();
    }

    updateStats();

    setFeedback(message, feedbackClass);
    renderRoundState();
    scrollStatusIntoView();

    if (autoAdvance && autoAdvanceEnabled) {
      beginRoundTransition(advanceAfterMs, transitionLabel, startRound);
    }
  }

  function advanceToNextRound() {
    try { window.worldleLiteLogger?.debug('[round] advanceToNextRound'); } catch (e) {}
    runtime.roundTransitions.clearRoundTransition();
    startRound();
  }

  /**
   * Mark the matched country as solved on the map, credit a correct answer,
   * and finish the round with a win outcome.
   *
   * @param {object|null} match  GeoJSON feature for the matched country.
   */
  function handleWin(match) {
    try { window.worldleLiteLogger?.info('[round] handleWin', match && (match.properties?.name || match)); } catch (e) {}
    if (!match) {
      return;
    }

    runtime.roundUi.fillNextGuessPill(match, "correct");
    runtime.worldMapInst.markSolved(match);
    actions.incrementCorrect();
    registerSolvedCountry(match);

    finishRound({
      outcome: ROUND_OUTCOME.won,
      message: config.COPY.feedback.correct,
      feedbackClass: config.CORRECT_MSG_CLASS,
      advanceAfterMs: config.ROUND_ADVANCE_MS.correct,
      transitionLabel: config.COPY.transitions.loadingNextCountry,
      autoAdvance: true
    });
  }

  /**
   * Compute proximity between a guessed country and the current target.
   *
   * Returns `{ adjacent: true, arrow }` when the two countries share a border,
   * `{ adjacent: false, distanceKm, arrow }` when a measurable gap exists, or
   * `null` when the required geometry data is unavailable.
   *
   * @param {object} guessFeature   GeoJSON feature for the guessed country.
   * @param {object} targetFeature  GeoJSON feature for the target country.
   * @returns {{ adjacent: boolean, arrow: string, distanceKm?: number } | null}
   */
  function computeProximityInfo(guessFeature, targetFeature) {
    try {
      const geo = window.continentGeometry;
      const guessCenter = guessFeature.properties.geometryCenter;
      const targetCenter = targetFeature.properties.geometryCenter;

      const centersAvailable =
        Array.isArray(guessCenter) && guessCenter.length >= 2 &&
        Array.isArray(targetCenter) && targetCenter.length >= 2;

      const adjacent = (guessFeature.properties.neighborIsoCodes ?? []).includes(targetFeature.properties.isoCode);

      const arrow = centersAvailable ? geo.compassBearing(guessCenter, targetCenter) : "";

      if (adjacent) {
        return { adjacent: true, arrow };
      }

      if (centersAvailable) {
        return { adjacent: false, distanceKm: geo.haversineDistanceKm(guessCenter, targetCenter), arrow };
      }
    } catch (e) { try { window.worldleLiteLogger?.warn('[round] computeProximityInfo failed', e); } catch (_) {} }

    return null;
  }

  /**
   * Record an incorrect guess: fill the next guess pill and mark the country
   * on the map.  If this was the last allowed miss, finish the round as missed;
   * otherwise play wrong audio and shake the input.
   *
   * @param {object|null} match           GeoJSON feature for the guessed country.
   * @param {number}      remaining       Guesses remaining after this one.
   * @param {boolean}     shouldEndRound  `true` if this was the last allowed miss.
   */
  function handleGuess(match, remaining, shouldEndRound) {
    try { window.worldleLiteLogger?.debug('[round] handleGuess', { match: match && (match.properties?.name || match), remaining, shouldEndRound }); } catch (e) {}
    if (!match) {
      return;
    }

    const { fillNextGuessPill, setFeedback, shakeInput } = runtime.roundUi;
    const proximityInfo = computeProximityInfo(match, state.store.targetCountry);

    fillNextGuessPill(match, "guess", proximityInfo);
    runtime.worldMapInst.markWrong(match);

    if (shouldEndRound) {
      finishRound({
        outcome: ROUND_OUTCOME.missed,
        message: config.COPY.feedback.outOfGuesses,
        feedbackClass: config.FAILURE_MSG_CLASS,
        advanceAfterMs: config.ROUND_ADVANCE_MS.miss,
        transitionLabel: config.COPY.transitions.loadingNextCountry,
        autoAdvance: false
      });
    } else {
      runtime.IMPORTS.audioFeedback.wrong();
      setFeedback(`${config.COPY.feedback.wrongPrefix}${remaining}${config.COPY.feedback.wrongSuffix}`, config.WRONG_MSG_CLASS);
      shakeInput();
    }
  }

  /**
   * Enable or disable the hint button based on whether the round is still
   * active and hints remain.
   */
  function syncHintState() {
    if (!dom.hintBtn) {
      return;
    }

    const roundState = actions.getRoundState(config.MAX_MISSES_PER_ROUND);
    dom.hintBtn.disabled = roundState.outcome !== ROUND_OUTCOME.active || roundState.hintsRemaining <= 0;
  }

  /**
   * Read the current input value, submit it via round store actions, and
   * dispatch the appropriate win/wrong handler.  Primes audio on every call.
   */
  function submitGuess() {
    try { window.worldleLiteLogger?.debug('[round] submitGuess - invoked'); } catch (e) {}
    runtime.IMPORTS.audioFeedback.primeAudio();

    const roundState = actions.getRoundState(config.MAX_MISSES_PER_ROUND);

    if (roundState.outcome !== ROUND_OUTCOME.active || !runtime.input.validateInput()) {
      return;
    }

    const userGuess = dom.input.value.trim();
    try { window.worldleLiteLogger?.debug('[round] submitGuess - userGuess', userGuess); } catch (e) {}
    const result = actions.submitRoundGuess(userGuess, config.MAX_MISSES_PER_ROUND);
    const match = actions.resolveCountryGuess(userGuess);

    runtime.input.clearForm();

    if (result.status === "locked" || result.status === "invalid") {
      return;
    }

    if (result.status === "duplicate") {
      try { window.worldleLiteLogger?.debug('[round] submitGuess - duplicate'); } catch (e) {}
      runtime.roundUi.shakeInput();
      return;
    }

    if (result.status === "correct") {
      handleWin(match);
    } else {
      handleGuess(match, result.remaining, result.status === "missed");
    }
  }

  /**
   * Sync all round-state-dependent UI: the reveal panel visibility and text,
   * the input placeholder, the reveal button, and the hint button.
   */
  function renderRoundState() {
    // 1. Guard: required nodes must exist.
    if (!dom.revealTarget || !state || !state.store || !actions || !config) {
      console.warn('[round] renderRoundState early return - missing dom, state, actions, or config', { 
        domRevealTarget: !!dom.revealTarget,
        state: !!state,
        store: !!state?.store,
        actions: !!actions,
        config: !!config
      });
      return;
    }

    // 2. Derive current round flags.
    const roundState = actions.getRoundState(config.MAX_MISSES_PER_ROUND);
    const showRevealPanel = Boolean(state.store.targetCountry && roundState.outcome !== ROUND_OUTCOME.active && roundState.outcome !== ROUND_OUTCOME.won);

    // 3. Render reveal panel visibility and answer text.
    if (dom.revealPanel) {
      dom.revealPanel.hidden = !showRevealPanel;
    }

    if (showRevealPanel) {
      const displayName = state.store.targetCountry.properties.displayName ?? state.store.targetCountry.properties.name ?? "";
      const link = document.createElement("a");
      link.className = "reveal-country-link";
      link.href = runtime.roundUi.buildWikipediaUrl(displayName);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = displayName;

      dom.revealTarget.textContent = `${config.COPY.reveal.answerPrefix}`;
      dom.revealTarget.appendChild(link);
    } else {
      dom.revealTarget.textContent = "";
    }

    // 4. Render input/reveal control states.
    if (dom.input) {
      dom.input.placeholder = roundState.outcome === ROUND_OUTCOME.active ? config.COPY.input.idlePlaceholder : config.COPY.input.lockedPlaceholder;
    }

    if (dom.revealBtn) {
      dom.revealBtn.disabled = roundState.outcome !== ROUND_OUTCOME.active;
    }

    if (dom.replayHaloBtn) {
      dom.replayHaloBtn.disabled = !state.store.targetCountry;
    }

    if (dom.nextRoundBtn) {
      const roundFinished = roundState.outcome !== ROUND_OUTCOME.active;
      const autoAdvanceEnabled = runtime.autoAdvance?.isEnabled?.() ?? true;
      const transitionRunning = Boolean(runtime.roundTransitionTimer);

      dom.nextRoundBtn.hidden = !(roundFinished && (!autoAdvanceEnabled || !transitionRunning));
      dom.nextRoundBtn.disabled = !roundFinished;
    }

    // 5. Keep hint button state in sync.
    syncHintState();
    runtime.roundUi.updateHintUsage();
  }

  /**
   * Re-show the target halo without changing round state.
   * Uses a custom startTime option to make it initiate immediately.
   */
  function replayHalo() {
    try { window.worldleLiteLogger?.debug('[round] replayHalo'); } catch (e) {}
    const replayCountry = window.__WORLDLE_DEBUG__
      ? window.worldleLiteDebug?.getLastClickedCountry?.() || state.store.targetCountry
      : state.store.targetCountry;

    if (!replayCountry) {
      return;
    }

    // Pass startTime option to make halo initiate immediately without delay
    runtime.worldMapInst.showLocationHalo(replayCountry, { startTime: Date.now() });
  }

  /**
   * Request the next hint from the store and update the hint display.
   * Syncs hint button state regardless of whether a new hint was revealed.
   */
  function showNextHint() {
    console.log('[round] showNextHint called');
    try { window.worldleLiteLogger?.debug('[round] showNextHint'); } catch (e) {}
    const result = actions.requestRoundHint();
    console.log('[round] requestRoundHint returned:', result);

    if (!result.changed) {
      console.log('[round] no change, result.changed is false');
      runtime.roundUi.updateHintUsage();
      syncHintState();
      return;
    }

    console.log('[round] changed=true, calling setHints with:', result.revealedHints);
    runtime.roundUi.setHints(result.revealedHints);
    runtime.roundUi.updateHintUsage();
    runtime.roundUi.updateStats();
    syncHintState();
  }

  /**
   * Pick the next target country from the eligible pool, reset all round
   * state, mark the target on the map, and animate the map zoom to the target.
   */
  function startRound() {
    try { window.worldleLiteLogger?.info('[round] startRound - selecting next target', { selectedContinent: state.store.selectedContinent, countriesAvailable: (state.store.countriesData || []).length }); } catch (e) {}
    
    // Guard: ensure runtime is fully initialized
    if (!runtime.roundUi || !runtime.input || !runtime.worldMapInst || !actions) {
      try { window.worldleLiteLogger?.error('[round] startRound - runtime not fully initialized yet'); } catch (e) {}
      console.error('[round] startRound early exit - runtime not initialized:', {
        roundUi: !!runtime.roundUi,
        input: !!runtime.input,
        worldMapInst: !!runtime.worldMapInst,
        actions: !!actions
      });
      return;
    }
    
    // Normal startRound flow — bootstrap is responsible for initial sequencing.
    const { clearRoundTransition } = runtime.roundTransitions;
    const { clearFeedback, clearHints, renderGuessPlaceholders } = runtime.roundUi;

    window.worldleLiteDebug?.clearLastClickedCountry?.();

    // 1. Reset prior round
    clearRoundTransition();
    if (runtime.roundRevealTimer) {
      clearTimeout(runtime.roundRevealTimer);
      runtime.roundRevealTimer = null;
    }
    runtime.roundUi.clearCelebration();
    runtime.input.clearForm();
    runtime.input.syncGuessButtonState(false);
    renderGuessPlaceholders();
    runtime.worldMapInst.resetRoundState();
    clearFeedback();
    clearHints();

    // 2. Pick next target
    const pool = state.store.selectedContinent
      ? state.store.countriesData.filter((country) => (
          runtime.input.isCountryInSelectedContinent(country, state.store.selectedContinent)
        ))
      : state.store.countriesData;
    const candidatePool = pool.length > 0 ? pool : state.store.countriesData;
    const poolKey = state.store.selectedContinent || "all";
    const nextTargetCountry = state.targetSelector.getNextTarget(candidatePool, poolKey);

    if (!nextTargetCountry) {
      try { window.worldleLiteLogger?.warn('[round] startRound - no target selected'); } catch (e) {}
      return;
    }

    // 3. Initialize store & UI
    try { window.worldleLiteLogger?.info('[round] startRound - nextTarget', nextTargetCountry && (nextTargetCountry.properties?.name || nextTargetCountry)); } catch (e) {}
    actions.setTargetCountry(nextTargetCountry);
    actions.setSelectedIndex(-1);
    runtime.worldMapInst.markTarget(nextTargetCountry);
    actions.startRound(nextTargetCountry.properties.name);
    actions.incrementPlayed();
    runtime.roundUi.updateStats();
    renderRoundState();
    runtime.input.syncGuessButtonState(false);

    // 4. Zoom to target
    const runZoom = () => runtime.worldMapInst.zoomToCountry(nextTargetCountry);

    if (!state.store.hasShownFirstRound) {
      // Defer zoom by two frames so the first-round reveal animation settles first.
      actions.showFirstRound();
      requestAnimationFrame(() => {
        requestAnimationFrame(runZoom);
      });
    } else {
      runZoom();
    }

    // 5. Schedule location halo
    runtime.roundRevealTimer = setTimeout(() => {
      runtime.roundRevealTimer = null;
      runtime.worldMapInst.showLocationHalo(nextTargetCountry);
      dom.input.focus({ preventScroll: true });
    }, 1100);
  }

  /**
   * Ask the round reducer action to reveal the answer, then call `finishRound`
   * with the reveal outcome.  Does nothing if the round is already over or no
   * target has been set.
   */
  function revealAnswer() {
    if (!state.store.targetCountry) {
      return;
    }

    try { window.worldleLiteLogger?.debug('[round] revealAnswer'); } catch (e) {}
    const result = actions.revealRoundAnswer();

    if (!result.changed) {
      return;
    }

    finishRound({
      outcome: result.outcome,
      message: config.COPY.feedback.answerShown,
      feedbackClass: config.FAILURE_MSG_CLASS,
      advanceAfterMs: config.ROUND_ADVANCE_MS.reveal,
      transitionLabel: config.COPY.transitions.loadingNextCountry,
      autoAdvance: false
    });
  }

  /** Reset scores to zero and start a fresh round ("New game" button handler). */
  function resetAll() {
    runtime.roundTransitions.clearRoundTransition();
    runtime.roundUi.clearCelebration();
    actions.resetScores();
    runtime.roundUi.updateStats();
    startRound();
  }

  runtime.roundControl = {
    startRound,
    advanceToNextRound,
    renderRoundState,
    showNextHint,
    revealAnswer,
    replayHalo,
    submitGuess,
    resetAll
  };
})();
