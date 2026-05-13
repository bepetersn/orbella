/**
 * @fileoverview Round-state actions: start, hint, guess submission, and reveal.
 */
import { worldleLiteLogger as log } from '../app/logger.js';
import { dispatch, getCurrentState } from './reducer.js';
import { normalizeGuess } from './normalize.js';
import { resolveCountryGuess } from './query.js';
import { ROUND_OUTCOME, STATE_ACTIONS } from './constants.js';
import { incrementHintsUsed } from './actions.js';
const MAX_HINTS_PER_ROUND = window.gameConfig?.MAX_HINTS_PER_ROUND ?? 3;

const letterOnlyPattern = /\p{L}/gu;

function getFirstLetter(targetName) {
  const matchedLetters = String(targetName ?? '').match(letterOnlyPattern);
  return matchedLetters?.[0] ?? '';
}

function getLetterCount(targetName) {
  const matchedLetters = String(targetName ?? '').match(letterOnlyPattern);
  return matchedLetters?.length ?? 0;
}

export function getRoundState(maxMissesPerRound = 3, maxHintsPerRound = MAX_HINTS_PER_ROUND) {
  const roundState = getCurrentState().round;
  return {
    outcome: roundState.outcome,
    targetName: roundState.targetName,
    missesUsed: roundState.missesUsed,
    missesRemaining: maxMissesPerRound - roundState.missesUsed,
    maxMissesPerRound,
    hintLevel: roundState.hintLevel,
    revealedHints: [...roundState.revealedHints],
    hintsRemaining: Math.max(0, maxHintsPerRound - roundState.hintLevel),
  };
}

export function canSubmitRound() {
  return getCurrentState().round.outcome === ROUND_OUTCOME.active;
}

export function startRound(targetName) {
  const normalizedTargetName = String(targetName).trim();
  const nextRoundState = {
    outcome: ROUND_OUTCOME.active,
    targetName: normalizedTargetName,
    missesUsed: 0,
    guesses: [],
    hintLevel: 0,
    revealedHints: [],
  };

  dispatch({ type: STATE_ACTIONS.setRoundState, round: nextRoundState });
  return getRoundState();
}

export function revealRoundAnswer() {
  const roundState = getCurrentState().round;

  if (!canSubmitRound()) {
    return { changed: false, outcome: roundState.outcome };
  }

  const nextRoundState = {
    ...roundState,
    outcome: ROUND_OUTCOME.revealed,
  };

  dispatch({ type: STATE_ACTIONS.setRoundState, round: nextRoundState });
  return { changed: true, outcome: nextRoundState.outcome, targetName: nextRoundState.targetName };
}

export function requestRoundHint(maxHintsPerRound = MAX_HINTS_PER_ROUND) {
  const roundState = getCurrentState().round;
  const targetCountry = getCurrentState().targetCountry;

  log.debug('[store] requestRoundHint called', {
    canSubmit: canSubmitRound(),
    targetName: roundState.targetName,
    hintLevel: roundState.hintLevel,
    targetCountryName: targetCountry?.properties?.name,
    maxHintsPerRound,
  });

  if (!canSubmitRound() || !roundState.targetName) {
    log.warn('[store] requestRoundHint early exit', {
      canSubmit: canSubmitRound(),
      hasTargetName: !!roundState.targetName,
    });
    return {
      changed: false,
      outcome: roundState.outcome,
      hintLevel: roundState.hintLevel,
      revealedHints: [...roundState.revealedHints],
      hintsRemaining: Math.max(0, maxHintsPerRound - roundState.hintLevel),
    };
  }

  if (roundState.hintLevel >= maxHintsPerRound) {
    log.warn('[store] requestRoundHint - max hints reached', {
      hintLevel: roundState.hintLevel,
      maxHintsPerRound,
    });
    return {
      changed: false,
      outcome: roundState.outcome,
      hintLevel: roundState.hintLevel,
      revealedHints: [...roundState.revealedHints],
      hintsRemaining: 0,
    };
  }

  const nextHintLevel = roundState.hintLevel + 1;
  const nextHint =
    nextHintLevel === 1
      ? { type: 'flag', value: targetCountry?.properties?.flagEmoji ?? '' }
      : nextHintLevel === 2
        ? { type: 'first-letter', value: getFirstLetter(roundState.targetName) }
        : { type: 'letter-count', value: getLetterCount(roundState.targetName) };

  log.debug('[store] generated new hint', {
    nextHintLevel,
    nextHint,
    targetName: roundState.targetName,
  });

  const nextRoundState = {
    ...roundState,
    hintLevel: nextHintLevel,
    revealedHints: [...roundState.revealedHints, nextHint],
  };

  dispatch({ type: STATE_ACTIONS.setRoundState, round: nextRoundState });
  incrementHintsUsed();

  const result = {
    changed: true,
    outcome: nextRoundState.outcome,
    hintLevel: nextRoundState.hintLevel,
    hint: nextHint,
    revealedHints: [...nextRoundState.revealedHints],
    hintsRemaining: Math.max(0, maxHintsPerRound - nextRoundState.hintLevel),
  };

  log.debug('[store] requestRoundHint returning', { result });
  return result;
}

export function submitRoundGuess(guessName, maxMissesPerRound = 3) {
  // 1. Guard rails: reject guesses when round is locked or input is empty.
  const roundState = getCurrentState().round;

  if (!canSubmitRound()) {
    return { status: 'locked', outcome: roundState.outcome };
  }

  if (!guessName) {
    return { status: 'invalid', outcome: roundState.outcome };
  }

  // 2. Normalize and check for a correct guess.
  const matchedCountry = resolveCountryGuess(guessName);
  if (!matchedCountry) {
    return { status: 'invalid', outcome: roundState.outcome };
  }

  const normalizedGuess = normalizeGuess(matchedCountry?.properties?.name ?? guessName);
  const normalizedTarget = normalizeGuess(
    getCurrentState().targetCountry?.properties?.name ?? roundState.targetName
  );

  if (normalizedGuess === normalizedTarget) {
    const nextRoundState = {
      ...roundState,
      outcome: ROUND_OUTCOME.won,
    };

    dispatch({ type: STATE_ACTIONS.setRoundState, round: nextRoundState });
    return {
      status: 'correct',
      outcome: nextRoundState.outcome,
      targetName: nextRoundState.targetName,
    };
  }

  // 3. Ignore repeated guesses.
  if (roundState.guesses.includes(normalizedGuess)) {
    return {
      status: 'duplicate',
      outcome: roundState.outcome,
      remaining: maxMissesPerRound - roundState.missesUsed,
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
      outcome: ROUND_OUTCOME.missed,
    };

    dispatch({ type: STATE_ACTIONS.setRoundState, round: nextRoundState });
    return {
      status: 'missed',
      outcome: nextRoundState.outcome,
      remaining: 0,
      targetName: nextRoundState.targetName,
    };
  }

  const nextRoundState = {
    ...roundState,
    missesUsed: nextMissesUsed,
    guesses: nextGuesses,
  };

  dispatch({ type: STATE_ACTIONS.setRoundState, round: nextRoundState });

  return {
    status: 'guess',
    outcome: nextRoundState.outcome,
    remaining: maxMissesPerRound - nextRoundState.missesUsed,
    guessName: normalizedGuess,
  };
}

