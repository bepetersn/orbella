/**
 * @fileoverview Round flow control – guess submission, win/loss handling,
 * reveal, and new-round start.
 *
 * Coordinates store round actions, `worldMapInst`, `audioFeedback`, `roundUi`,
 * and `roundTransitions` to drive the full round lifecycle.
 *
 * Attaches itself to `runtime.roundControl`.
 */
import { ROUND_OUTCOME } from '../../store/constants.js';
import { continentGeometry } from '../../map/geometry.js';
import { getLastClickedCountry, clearLastClickedCountry } from '../debug.js';
import { worldleLiteLogger as log } from '../logger.js';

import { getRuntime } from '../runtime.js';

const getDom = () => getRuntime().dom ?? {};
const getState = () => getRuntime().state ?? {};
const getConfig = () => getRuntime().config ?? {};
const getActions = () => getRuntime().actions ?? {};
const solvedCountriesByRegion = new Map();
const celebratedRegions = new Set();

function getRegionKey() {
  return getState().store.selectedContinent || 'all';
}

function getRegionLabel() {
  return getState().store.selectedContinent || 'the world';
}

function getEligibleCountriesForRegion() {
  if (!getState().store.selectedContinent) {
    return getState().store.countriesData;
  }

  return getState().store.countriesData.filter((country) =>
    getRuntime().input.isCountryInSelectedContinent(country, getState().store.selectedContinent)
  );
}

function registerSolvedCountry(match) {
  const countryName = match?.properties?.displayName ?? match?.properties?.name;
  if (!countryName) {
    return false;
  }

  const regionKey = getRegionKey();
  const solvedSet = solvedCountriesByRegion.get(regionKey) || new Set();
  solvedSet.add(getActions().normalizeGuess(countryName));
  solvedCountriesByRegion.set(regionKey, solvedSet);

  const eligibleCountryCount = getEligibleCountriesForRegion().length;
  if (
    !eligibleCountryCount ||
    solvedSet.size < eligibleCountryCount ||
    celebratedRegions.has(regionKey)
  ) {
    return false;
  }

  celebratedRegions.add(regionKey);
  getRuntime().roundUi.showCelebration(`You solved every country in ${getRegionLabel()}.`);
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
function finishRound({
  outcome,
  message,
  feedbackClass,
  advanceAfterMs,
  transitionLabel,
  autoAdvance = true,
}) {
  log.info('[round] finishRound', { outcome, message, autoAdvance });
  log.debug('[round] finishRound - autoAdvance state', {
    runtimeAutoAdvanceEnabled: getRuntime().autoAdvanceEnabled,
    autoAdvanceIsEnabledFn: getRuntime().autoAdvance?.isEnabled?.(),
  });
  const { setFeedback } = getRuntime().roundUi;
  const { beginRoundTransition, scrollStatusIntoView } = getRuntime().roundTransitions;
  const autoAdvanceEnabled = getRuntime().autoAdvance?.isEnabled?.() ?? true;

  if (outcome !== ROUND_OUTCOME.won) {
    getRuntime().audioFeedback.loss();
  } else {
    getRuntime().audioFeedback.correct();
  }

  setFeedback(message, feedbackClass);
  renderRoundState();
  scrollStatusIntoView();

  if (autoAdvance && autoAdvanceEnabled) {
    beginRoundTransition(advanceAfterMs, transitionLabel, startRound);
  }
}

/**
 * Mark the matched country as solved on the map, credit a correct answer,
 * and finish the round with a win outcome.
 *
 * @param {object|null} match  GeoJSON feature for the matched country.
 */
function handleWin(match) {
  log.info('[round] handleWin', match && (match.properties?.name || match));
  if (!match) {
    return;
  }

  getRuntime().roundUi.fillNextGuessPill(match, 'correct');
  getRuntime().worldMapInst.markSolved(match);
  getActions().incrementCorrect();
  registerSolvedCountry(match);

  finishRound({
    outcome: ROUND_OUTCOME.won,
    message: getConfig().COPY.feedback.correct,
    feedbackClass: getConfig().CORRECT_MSG_CLASS,
    advanceAfterMs: getConfig().ROUND_ADVANCE_MS.correct,
    transitionLabel: getConfig().COPY.transitions.loadingNextCountry,
    autoAdvance: true,
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
    const geo = continentGeometry;
    const guessCenter = guessFeature.properties.geometryCenter;
    const targetCenter = targetFeature.properties.geometryCenter;

    const centersAvailable =
      Array.isArray(guessCenter) &&
      guessCenter.length >= 2 &&
      Array.isArray(targetCenter) &&
      targetCenter.length >= 2;

    const adjacent = (guessFeature.properties.neighborIsoCodes ?? []).includes(
      targetFeature.properties.isoCode
    );

    const arrow = centersAvailable ? geo.compassBearing(guessCenter, targetCenter) : '';

    if (adjacent) {
      return { adjacent: true, arrow };
    }

    if (centersAvailable) {
      return {
        adjacent: false,
        distanceKm: geo.haversineDistanceKm(guessCenter, targetCenter),
        arrow,
      };
    }
  } catch (e) {
    log.warn('[round] computeProximityInfo failed', e);
  }

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
  log.debug('[round] handleGuess', {
    match: match && (match.properties?.name || match),
    remaining,
    shouldEndRound,
  });
  if (!match) {
    return;
  }

  const { fillNextGuessPill, setFeedback, shakeInput } = getRuntime().roundUi;
  const proximityInfo = computeProximityInfo(match, getState().store.targetCountry);

  fillNextGuessPill(match, 'guess', proximityInfo);
  getRuntime().worldMapInst.markWrong(match);

  if (shouldEndRound) {
    finishRound({
      outcome: ROUND_OUTCOME.missed,
      message: getConfig().COPY.feedback.outOfGuesses,
      feedbackClass: getConfig().FAILURE_MSG_CLASS,
      advanceAfterMs: getConfig().ROUND_ADVANCE_MS.miss,
      transitionLabel: getConfig().COPY.transitions.loadingNextCountry,
      autoAdvance: false,
    });
  } else {
    getRuntime().audioFeedback.wrong();
    setFeedback(
      `${getConfig().COPY.feedback.wrongPrefix}${remaining}${getConfig().COPY.feedback.wrongSuffix}`,
      getConfig().WRONG_MSG_CLASS
    );
    shakeInput();
  }
}

/**
 * Enable or disable the hint button based on whether the round is still
 * active and hints remain.
 */
function syncHintState() {
  if (!getDom().hintBtn) {
    return;
  }

  const roundState = getActions().getRoundState(getConfig().MAX_MISSES_PER_ROUND);
  getDom().hintBtn.disabled =
    roundState.outcome !== ROUND_OUTCOME.active || roundState.hintsRemaining <= 0;
}

export function advanceToNextRound() {
  log.debug('[round] advanceToNextRound');
  getRuntime().roundTransitions.clearRoundTransition();
  startRound();
}

/**
 * Read the current input value, submit it via round store actions, and
 * dispatch the appropriate win/wrong handler.  Primes audio on every call.
 */
export function submitGuess() {
  log.debug('[round] submitGuess - invoked');
  getRuntime().audioFeedback.primeAudio();

  const roundState = getActions().getRoundState(getConfig().MAX_MISSES_PER_ROUND);

  if (roundState.outcome !== ROUND_OUTCOME.active || !getRuntime().input.validateInput()) {
    return;
  }

  const userGuess = getDom().input.value.trim();
  log.debug('[round] submitGuess - userGuess', userGuess);
  const result = getActions().submitRoundGuess(userGuess, getConfig().MAX_MISSES_PER_ROUND);
  const match = getActions().resolveCountryGuess(userGuess);

  getRuntime().input.clearForm();

  if (result.status === 'locked' || result.status === 'invalid') {
    return;
  }

  if (result.status === 'duplicate') {
    log.debug('[round] submitGuess - duplicate');
    getRuntime().roundUi.shakeInput();
    return;
  }

  if (result.status === 'correct') {
    handleWin(match);
  } else {
    handleGuess(match, result.remaining, result.status === 'missed');
  }
}

/**
 * Sync all round-state-dependent UI: the reveal panel visibility and text,
 * the input placeholder, the reveal button, and the hint button.
 */
export function renderRoundState() {
  // 1. Guard: required nodes must exist.
  if (
    !getDom().revealTarget ||
    !getState().store ||
    !getActions().getRoundState ||
    !getConfig().MAX_MISSES_PER_ROUND
  ) {
    console.warn('[round] renderRoundState early return - missing dom, state, actions, or config', {
      domRevealTarget: !!getDom().revealTarget,
      store: !!getState().store,
      actions: !!getActions().getRoundState,
      config: !!getConfig().MAX_MISSES_PER_ROUND,
    });
    return;
  }

  // 2. Derive current round flags.
  const roundState = getActions().getRoundState(getConfig().MAX_MISSES_PER_ROUND);
  const showRevealPanel = Boolean(
    getState().store.targetCountry &&
    roundState.outcome !== ROUND_OUTCOME.active &&
    roundState.outcome !== ROUND_OUTCOME.won
  );

  // 3. Render reveal panel visibility and answer text.
  if (getDom().revealPanel) {
    getDom().revealPanel.hidden = !showRevealPanel;
  }

  if (showRevealPanel) {
    const displayName =
      getState().store.targetCountry.properties.displayName ??
      getState().store.targetCountry.properties.name ??
      '';
    const link = document.createElement('a');
    link.className = 'reveal-country-link';
    link.href = getRuntime().roundUi.buildWikipediaUrl(displayName);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = displayName;

    getDom().revealTarget.textContent = `${getConfig().COPY.reveal.answerPrefix}`;
    getDom().revealTarget.appendChild(link);
  } else {
    getDom().revealTarget.textContent = '';
  }

  // 4. Render input/reveal control states.
  if (getDom().input) {
    getDom().input.placeholder =
      roundState.outcome === ROUND_OUTCOME.active
        ? getConfig().COPY.input.idlePlaceholder
        : getConfig().COPY.input.lockedPlaceholder;
  }

  if (getDom().revealBtn) {
    getDom().revealBtn.disabled = roundState.outcome !== ROUND_OUTCOME.active;
  }

  if (getDom().replayHaloBtn) {
    getDom().replayHaloBtn.disabled = !getState().store.targetCountry;
  }

  if (getDom().nextRoundBtn) {
    const roundFinished = roundState.outcome !== ROUND_OUTCOME.active;
    const autoAdvanceEnabled = getRuntime().autoAdvance?.isEnabled?.() ?? true;
    const transitionRunning = getRuntime().timers.isActive('roundTransition');

    getDom().nextRoundBtn.hidden = !(roundFinished && (!autoAdvanceEnabled || !transitionRunning));
    getDom().nextRoundBtn.disabled = !roundFinished;
  }

  // 5. Keep hint button state in sync, and sync the score display.
  syncHintState();
  getRuntime().roundUi.updateHintUsage();
  getRuntime().roundUi.updateStats();
}

/**
 * Re-show the target halo without changing round state.
 * Uses a custom startTime option to make it initiate immediately.
 */
export function replayHalo() {
  log.debug('[round] replayHalo');
  const replayCountry = window.__WORLDLE_DEBUG__
    ? getLastClickedCountry() || getState().store.targetCountry
    : getState().store.targetCountry;

  if (!replayCountry) {
    return;
  }

  // Pass startTime option to make halo initiate immediately without delay
  getRuntime().worldMapInst.showLocationHalo(replayCountry, { startTime: Date.now() });
}

/**
 * Request the next hint from the store and update the hint display.
 * Syncs hint button state regardless of whether a new hint was revealed.
 */
export function showNextHint() {
  log.debug('[round] showNextHint called');
  const result = getActions().requestRoundHint();
  log.debug('[round] requestRoundHint returned:', result);

  if (!result.changed) {
    log.debug('[round] no change, result.changed is false');
    renderRoundState();
    return;
  }

  log.debug('[round] changed=true, calling setHints with:', result.revealedHints);
  getRuntime().roundUi.setHints(result.revealedHints);
  renderRoundState();
}

/**
 * Pick the next target country from the eligible pool, reset all round
 * state, mark the target on the map, and animate the map zoom to the target.
 */
export function startRound() {
  log.info('[round] startRound - selecting next target', {
    selectedContinent: getState().store.selectedContinent,
    countriesAvailable: (getState().store.countriesData || []).length,
  });

  // Guard: ensure runtime is fully initialized
  if (
    !getRuntime().roundUi ||
    !getRuntime().input ||
    !getRuntime().worldMapInst ||
    !getActions().getRoundState
  ) {
    log.error('[round] startRound - runtime not fully initialized yet');
    console.error('[round] startRound early exit - runtime not initialized:', {
      roundUi: !!getRuntime().roundUi,
      input: !!getRuntime().input,
      worldMapInst: !!getRuntime().worldMapInst,
      actions: !!getActions().getRoundState,
    });
    return;
  }

  // Normal startRound flow — bootstrap is responsible for initial sequencing.
  const { clearRoundTransition } = getRuntime().roundTransitions;
  const { clearFeedback, clearHints, renderGuessPlaceholders } = getRuntime().roundUi;

  clearLastClickedCountry();

  // 1. Reset prior round
  clearRoundTransition();
  getRuntime().timers.cancel('roundReveal');
  getRuntime().roundUi.clearCelebration();
  getRuntime().input.clearForm();
  getRuntime().input.syncGuessButtonState(false);
  renderGuessPlaceholders();
  getRuntime().worldMapInst.resetRoundState();
  clearFeedback();
  clearHints();

  // 2. Pick next target
  const pool = getEligibleCountriesForRegion();
  const candidatePool = pool.length > 0 ? pool : getState().store.countriesData;
  const poolKey = getState().store.selectedContinent || 'all';
  const nextTargetCountry = getState().targetSelector.getNextTarget(candidatePool, poolKey);

  if (!nextTargetCountry) {
    log.warn('[round] startRound - no target selected');
    return;
  }

  // 3. Initialize store & UI
  log.info(
    '[round] startRound - nextTarget',
    nextTargetCountry && (nextTargetCountry.properties?.name || nextTargetCountry)
  );
  getActions().setTargetCountry(nextTargetCountry);
  getActions().setSelectedIndex(-1);
  getRuntime().worldMapInst.markTarget(nextTargetCountry);
  getActions().startRound(nextTargetCountry.properties.name);
  getActions().incrementPlayed();
  renderRoundState();
  getRuntime().input.syncGuessButtonState(false);

  // 4. Zoom to target
  const runZoom = () => getRuntime().worldMapInst.zoomToCountry(nextTargetCountry);

  if (!getState().store.hasShownFirstRound) {
    // Defer zoom by two frames so the first-round reveal animation settles first.
    getActions().showFirstRound();
    requestAnimationFrame(() => {
      requestAnimationFrame(runZoom);
    });
  } else {
    runZoom();
  }

  // 5. Schedule location halo
  getRuntime().timers.schedule(
    'roundReveal',
    () => {
      getRuntime().worldMapInst.showLocationHalo(nextTargetCountry);
      getDom().input.focus({ preventScroll: true });
    },
    1100
  );
}

/**
 * Ask the round reducer action to reveal the answer, then call `finishRound`
 * with the reveal outcome.  Does nothing if the round is already over or no
 * target has been set.
 */
export function revealAnswer() {
  if (!getState().store.targetCountry) {
    return;
  }

  log.debug('[round] revealAnswer');
  const result = getActions().revealRoundAnswer();

  if (!result.changed) {
    return;
  }

  finishRound({
    outcome: result.outcome,
    message: getConfig().COPY.feedback.answerShown,
    feedbackClass: getConfig().FAILURE_MSG_CLASS,
    advanceAfterMs: getConfig().ROUND_ADVANCE_MS.reveal,
    transitionLabel: getConfig().COPY.transitions.loadingNextCountry,
    autoAdvance: false,
  });
}

/** Reset scores to zero and start a fresh round ("New game" button handler). */
export function resetAll() {
  getRuntime().roundTransitions.clearRoundTransition();
  getRuntime().roundUi.clearCelebration();
  getActions().resetScores();
  startRound();
}

// Guard: only register the shim when the runtime is already installed
// (i.e. in tests).  Production wires runtime.roundControl in bootstrap.js.
if (typeof window !== 'undefined' && window.worldleLiteRuntime) {
  window.worldleLiteRuntime.roundControl = {
    submitGuess,
    startRound,
    revealAnswer,
    resetAll,
    renderRoundState,
    replayHalo,
    showNextHint,
    advanceToNextRound,
  };
}
