/**
 * @fileoverview Round-state actions: start, hint, guess submission, and reveal.
 *
 * Exposes `getRoundState`, `canSubmitRound`, `startRound`, `revealRoundAnswer`,
 * `requestRoundHint`, and `submitRoundGuess` on `window._gameStore`.
 */
(() => {
  const _store = window._gameStore;
  const { dispatch, getCurrentState, normalizeGuess, resolveCountryGuess, ROUND_OUTCOME, STATE_ACTIONS } = _store;
  const MAX_HINTS_PER_ROUND = window.gameConfig?.MAX_HINTS_PER_ROUND ?? 3;

  const letterOnlyPattern = /\p{L}/gu;

  function getFirstLetter(targetName) {
    const matchedLetters = String(targetName ?? "").match(letterOnlyPattern);
    return matchedLetters?.[0] ?? "";
  }

  function getLetterCount(targetName) {
    const matchedLetters = String(targetName ?? "").match(letterOnlyPattern);
    return matchedLetters?.length ?? 0;
  }

  function getRoundState(maxMissesPerRound = 3, maxHintsPerRound = MAX_HINTS_PER_ROUND) {
    const roundState = getCurrentState().round;
    return {
      outcome: roundState.outcome,
      targetName: roundState.targetName,
      missesUsed: roundState.missesUsed,
      missesRemaining: maxMissesPerRound - roundState.missesUsed,
      maxMissesPerRound,
      hintLevel: roundState.hintLevel,
      revealedHints: [...roundState.revealedHints],
      hintsRemaining: Math.max(0, maxHintsPerRound - roundState.hintLevel)
    };
  }

  function canSubmitRound() {
    return getCurrentState().round.outcome === ROUND_OUTCOME.active;
  }

  function startRound(targetName) {
    const normalizedTargetName = String(targetName).trim();
    const nextRoundState = {
      outcome: ROUND_OUTCOME.active,
      targetName: normalizedTargetName,
      missesUsed: 0,
      guesses: [],
      hintLevel: 0,
      revealedHints: []
    };

    dispatch({ type: STATE_ACTIONS.setRoundState, round: nextRoundState });
    return getRoundState();
  }

  function revealRoundAnswer() {
    const roundState = getCurrentState().round;

    if (!canSubmitRound()) {
      return { changed: false, outcome: roundState.outcome };
    }

    const nextRoundState = {
      ...roundState,
      outcome: ROUND_OUTCOME.revealed
    };

    dispatch({ type: STATE_ACTIONS.setRoundState, round: nextRoundState });
    return { changed: true, outcome: nextRoundState.outcome, targetName: nextRoundState.targetName };
  }

  function requestRoundHint(maxHintsPerRound = MAX_HINTS_PER_ROUND) {
    const roundState = getCurrentState().round;
    const targetCountry = getCurrentState().targetCountry;
    
    try { window.worldleLiteLogger?.debug('[store] requestRoundHint called', { 
      canSubmit: canSubmitRound(), 
      targetName: roundState.targetName, 
      hintLevel: roundState.hintLevel,
      targetCountryName: targetCountry?.properties?.name,
      maxHintsPerRound
    }); } catch (e) {}

    if (!canSubmitRound() || !roundState.targetName) {
      try { window.worldleLiteLogger?.warn('[store] requestRoundHint early exit', { canSubmit: canSubmitRound(), hasTargetName: !!roundState.targetName }); } catch (e) {}
      return {
        changed: false,
        outcome: roundState.outcome,
        hintLevel: roundState.hintLevel,
        revealedHints: [...roundState.revealedHints],
        hintsRemaining: Math.max(0, maxHintsPerRound - roundState.hintLevel)
      };
    }

    if (roundState.hintLevel >= maxHintsPerRound) {
      try { window.worldleLiteLogger?.warn('[store] requestRoundHint - max hints reached', { hintLevel: roundState.hintLevel, maxHintsPerRound }); } catch (e) {}
      return {
        changed: false,
        outcome: roundState.outcome,
        hintLevel: roundState.hintLevel,
        revealedHints: [...roundState.revealedHints],
        hintsRemaining: 0
      };
    }

    const nextHintLevel = roundState.hintLevel + 1;
    const nextHint = nextHintLevel === 1
      ? { type: "flag", value: targetCountry?.properties?.flagEmoji ?? "" }
      : nextHintLevel === 2
        ? { type: "first-letter", value: getFirstLetter(roundState.targetName) }
        : { type: "letter-count", value: getLetterCount(roundState.targetName) };
    
    try { window.worldleLiteLogger?.debug('[store] generated new hint', { nextHintLevel, nextHint, targetName: roundState.targetName }); } catch (e) {}
    
    const nextRoundState = {
      ...roundState,
      hintLevel: nextHintLevel,
      revealedHints: [...roundState.revealedHints, nextHint]
    };

    dispatch({ type: STATE_ACTIONS.setRoundState, round: nextRoundState });
    _store.incrementHintsUsed?.();

    const result = {
      changed: true,
      outcome: nextRoundState.outcome,
      hintLevel: nextRoundState.hintLevel,
      hint: nextHint,
      revealedHints: [...nextRoundState.revealedHints],
      hintsRemaining: Math.max(0, maxHintsPerRound - nextRoundState.hintLevel)
    };
    
    try { window.worldleLiteLogger?.debug('[store] requestRoundHint returning', { result }); } catch (e) {}
    return result;
  }

  function submitRoundGuess(guessName, maxMissesPerRound = 3) {
    // 1. Guard rails: reject guesses when round is locked or input is empty.
    const roundState = getCurrentState().round;

    if (!canSubmitRound()) {
      return { status: "locked", outcome: roundState.outcome };
    }

    if (!guessName) {
      return { status: "invalid", outcome: roundState.outcome };
    }

    // 2. Normalize and check for a correct guess.
    const matchedCountry = resolveCountryGuess(guessName);
    if (!matchedCountry) {
      return { status: "invalid", outcome: roundState.outcome };
    }

    const normalizedGuess = normalizeGuess(matchedCountry?.properties?.name ?? guessName);
    const normalizedTarget = normalizeGuess(getCurrentState().targetCountry?.properties?.name ?? roundState.targetName);

    if (normalizedGuess === normalizedTarget) {
      const nextRoundState = {
        ...roundState,
        outcome: ROUND_OUTCOME.won
      };

      dispatch({ type: STATE_ACTIONS.setRoundState, round: nextRoundState });
      return {
        status: "correct",
        outcome: nextRoundState.outcome,
        targetName: nextRoundState.targetName
      };
    }

    // 3. Ignore repeated guesses.
    if (roundState.guesses.includes(normalizedGuess)) {
      return {
        status: "duplicate",
        outcome: roundState.outcome,
        remaining: maxMissesPerRound - roundState.missesUsed
      };
    }

    // 4. Record the guess and either end the round or continue with remaining guesses.
    const nextMissesUsed = roundState.missesUsed + 1;
    const nextGuesses = [...roundState.guesses, normalizedGuess];

    if (nextMissesUsed >= maxMissesPerRound) {
      const nextRoundState = {
        ...roundState,
        missesUsed: nextMissesUsed,
        guesses: nextGuesses,
        outcome: ROUND_OUTCOME.missed
      };

      dispatch({ type: STATE_ACTIONS.setRoundState, round: nextRoundState });
      return {
        status: "missed",
        outcome: nextRoundState.outcome,
        remaining: 0,
        targetName: nextRoundState.targetName
      };
    }

    const nextRoundState = {
      ...roundState,
      missesUsed: nextMissesUsed,
      guesses: nextGuesses
    };

    dispatch({ type: STATE_ACTIONS.setRoundState, round: nextRoundState });

    return {
      status: "guess",
      outcome: nextRoundState.outcome,
      remaining: maxMissesPerRound - nextRoundState.missesUsed,
      guessName: normalizedGuess
    };
  }

  _store.getRoundState = getRoundState;
  _store.canSubmitRound = canSubmitRound;
  _store.startRound = startRound;
  _store.revealRoundAnswer = revealRoundAnswer;
  _store.requestRoundHint = requestRoundHint;
  _store.submitRoundGuess = submitRoundGuess;
})();
