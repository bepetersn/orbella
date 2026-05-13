/**
 * Smoke tests — Phase 1 export verification.
 *
 * Proves that every module converted in Phase 1 actually exposes its
 * public symbols via ES `export`. Each test does a real named import
 * from the source file and asserts the exported value is the right type.
 */
import { describe, it, expect } from 'vitest';

import { gameConfig } from '../../src/config.js';
import { gameConstants } from '../../src/constants.js';
import { STATE_ACTIONS, ROUND_OUTCOME } from '../../src/store/constants.js';
import { normalizeGuess, toLooseGuessKey } from '../../src/store/normalize.js';
import { createCountryGuessLookup } from '../../src/store/lookup.js';
import { resolveCountryGuess, getSuggestedCountryNames } from '../../src/store/query.js';
import { dispatch, getCurrentState, state } from '../../src/store/reducer.js';
import {
  getRoundState,
  canSubmitRound,
  startRound,
  revealRoundAnswer,
  requestRoundHint,
  submitRoundGuess,
} from '../../src/store/round.js';
import {
  loadCountriesIntoState,
  setSelectedIndex,
  setTargetCountry,
  showFirstRound,
  incrementCorrect,
  incrementPlayed,
  incrementHintsUsed,
  resetScores,
  setSelectedContinent,
} from '../../src/store/actions.js';
import { gameStore } from '../../src/store/index.js';

describe('Phase 1 — export smoke tests', () => {
  describe('src/config.js', () => {
    it('exports gameConfig as an object', () => {
      expect(gameConfig).toBeTypeOf('object');
      expect(gameConfig.MAX_MISSES_PER_ROUND).toBeTypeOf('number');
    });
  });

  describe('src/constants.js', () => {
    it('exports gameConstants as an object', () => {
      expect(gameConstants).toBeTypeOf('object');
      expect(gameConstants.COPY).toBeTypeOf('object');
    });
  });

  describe('src/store/constants.js', () => {
    it('exports STATE_ACTIONS with expected keys', () => {
      expect(STATE_ACTIONS).toBeTypeOf('object');
      expect(STATE_ACTIONS.loadCountries).toBe('loadCountries');
      expect(STATE_ACTIONS.setRoundState).toBe('setRoundState');
    });
    it('exports ROUND_OUTCOME with expected values', () => {
      expect(ROUND_OUTCOME.active).toBe('active');
      expect(ROUND_OUTCOME.won).toBe('won');
    });
  });

  describe('src/store/normalize.js', () => {
    it('exports normalizeGuess as a function', () => {
      expect(normalizeGuess).toBeTypeOf('function');
      expect(normalizeGuess('France')).toBe('france');
    });
    it('exports toLooseGuessKey as a function', () => {
      expect(toLooseGuessKey).toBeTypeOf('function');
      expect(toLooseGuessKey('New Zealand')).toBe('newzealand');
    });
  });

  describe('src/store/lookup.js', () => {
    it('exports createCountryGuessLookup as a function', () => {
      expect(createCountryGuessLookup).toBeTypeOf('function');
    });
  });

  describe('src/store/query.js', () => {
    it('exports resolveCountryGuess as a function', () => {
      expect(resolveCountryGuess).toBeTypeOf('function');
    });
    it('exports getSuggestedCountryNames as a function', () => {
      expect(getSuggestedCountryNames).toBeTypeOf('function');
    });
  });

  describe('src/store/reducer.js', () => {
    it('exports dispatch as a function', () => {
      expect(dispatch).toBeTypeOf('function');
    });
    it('exports getCurrentState as a function', () => {
      expect(getCurrentState).toBeTypeOf('function');
      expect(getCurrentState()).toBeTypeOf('object');
    });
    it('exports state as a proxy object', () => {
      expect(state).toBeTypeOf('object');
    });
  });

  describe('src/store/round.js', () => {
    it('exports all round functions', () => {
      expect(getRoundState).toBeTypeOf('function');
      expect(canSubmitRound).toBeTypeOf('function');
      expect(startRound).toBeTypeOf('function');
      expect(revealRoundAnswer).toBeTypeOf('function');
      expect(requestRoundHint).toBeTypeOf('function');
      expect(submitRoundGuess).toBeTypeOf('function');
    });
  });

  describe('src/store/actions.js', () => {
    it('exports all action functions', () => {
      expect(loadCountriesIntoState).toBeTypeOf('function');
      expect(setSelectedIndex).toBeTypeOf('function');
      expect(setTargetCountry).toBeTypeOf('function');
      expect(showFirstRound).toBeTypeOf('function');
      expect(incrementCorrect).toBeTypeOf('function');
      expect(incrementPlayed).toBeTypeOf('function');
      expect(incrementHintsUsed).toBeTypeOf('function');
      expect(resetScores).toBeTypeOf('function');
      expect(setSelectedContinent).toBeTypeOf('function');
    });
  });

  describe('src/store/index.js', () => {
    it('exports gameStore with expected public API', () => {
      expect(gameStore).toBeTypeOf('object');
      expect(gameStore.dispatch).toBeTypeOf('function');
      expect(gameStore.state).toBeTypeOf('object');
      expect(gameStore.ROUND_OUTCOME).toBeTypeOf('object');
    });
  });
});
