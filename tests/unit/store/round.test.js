/**
 * Tests for src/store/round.js — imports and exercises the REAL module.
 *
 * Each test resets modules so it gets a fresh store instance.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

let dispatch, startRound, submitRoundGuess, revealRoundAnswer, getRoundState, canSubmitRound;

function makeCountry(name, aliases = []) {
  return {
    properties: {
      name,
      displayName: name,
      aliases,
    },
  };
}

async function seedStore(targetCountry, extraCountries = []) {
  const { dispatch: d } = await import('../../../src/store/reducer.js');
  const { createCountryGuessLookup } = await import('../../../src/store/lookup.js');
  const countries = [targetCountry, ...extraCountries];
  const lookup = createCountryGuessLookup(countries, new Map());
  d({
    type: 'loadCountries',
    countriesData: countries,
    countryNames: countries.map((c) => c.properties.name),
    countryByName: new Map(countries.map((c) => [c.properties.name.toLowerCase(), c])),
    countryByGuess: lookup.countryByGuess,
    countryByLooseGuess: lookup.countryByLooseGuess,
    countryLookupEntries: lookup.countryLookupEntries,
  });
  d({ type: 'setTargetCountry', targetCountry });
  return d;
}

beforeEach(async () => {
  vi.resetModules();
  const roundMod = await import('../../../src/store/round.js');
  const reducerMod = await import('../../../src/store/reducer.js');
  dispatch = reducerMod.dispatch;
  startRound = roundMod.startRound;
  submitRoundGuess = roundMod.submitRoundGuess;
  revealRoundAnswer = roundMod.revealRoundAnswer;
  getRoundState = roundMod.getRoundState;
  canSubmitRound = roundMod.canSubmitRound;
});

describe('Store / Round (real)', () => {
  describe('startRound', () => {
    it('should set targetName and reset misses', async () => {
      const state = startRound('France');
      expect(state.targetName).toBe('France');
      expect(state.missesUsed).toBe(0);
      expect(state.outcome).toBe('active');
    });

    it('should reset hintLevel and guesses', async () => {
      const state = startRound('Germany');
      expect(state.hintLevel).toBe(0);
      expect(state.revealedHints).toEqual([]);
    });
  });

  describe('canSubmitRound', () => {
    it('should return true when round is active', () => {
      startRound('France');
      expect(canSubmitRound()).toBe(true);
    });

    it('should return false after round is won', async () => {
      const france = makeCountry('France');
      await seedStore(france);
      startRound('France');
      submitRoundGuess('France');
      expect(canSubmitRound()).toBe(false);
    });
  });

  describe('getRoundState', () => {
    it('should return missesRemaining relative to maxMissesPerRound', () => {
      startRound('France');
      const state = getRoundState(3);
      expect(state.missesRemaining).toBe(3);
    });
  });

  describe('submitRoundGuess', () => {
    it('should return correct status for an exact-match guess', async () => {
      const france = makeCountry('France');
      await seedStore(france);
      startRound('France');
      const result = submitRoundGuess('France');
      expect(result.status).toBe('correct');
      expect(result.outcome).toBe('won');
    });

    it('should return guess status and decrement remaining for a wrong guess', async () => {
      const france = makeCountry('France');
      await seedStore(france, [makeCountry('Germany')]);
      startRound('France');
      const result = submitRoundGuess('Germany');
      expect(result.status).toBe('guess');
      expect(result.remaining).toBe(2);
    });

    it('should return missed status when misses are exhausted', async () => {
      const france = makeCountry('France');
      await seedStore(france, [makeCountry('Germany'), makeCountry('Spain'), makeCountry('Italy')]);
      startRound('France');
      submitRoundGuess('Germany');
      submitRoundGuess('Spain');
      const result = submitRoundGuess('Italy');
      expect(result.status).toBe('missed');
      expect(result.remaining).toBe(0);
    });

    it('should return duplicate status for repeated wrong guess', async () => {
      const france = makeCountry('France');
      await seedStore(france, [makeCountry('Germany')]);
      startRound('France');
      submitRoundGuess('Germany');
      const result = submitRoundGuess('Germany');
      expect(result.status).toBe('duplicate');
    });

    it('should return locked when round is already over', async () => {
      const france = makeCountry('France');
      await seedStore(france);
      startRound('France');
      submitRoundGuess('France'); // wins round
      const result = submitRoundGuess('France');
      expect(result.status).toBe('locked');
    });

    it('should return invalid for empty guess', async () => {
      const france = makeCountry('France');
      await seedStore(france);
      startRound('France');
      const result = submitRoundGuess('');
      expect(result.status).toBe('invalid');
    });

    it('should return invalid for an unrecognised country name', async () => {
      const france = makeCountry('France');
      await seedStore(france);
      startRound('France');
      const result = submitRoundGuess('ZZZNoSuchCountry');
      expect(result.status).toBe('invalid');
    });

    it('should resolve an alias to the correct country', async () => {
      const usa = makeCountry('United States', ['USA', 'America']);
      await seedStore(usa);
      startRound('United States');
      const result = submitRoundGuess('USA');
      expect(result.status).toBe('correct');
    });
  });

  describe('revealRoundAnswer', () => {
    it('should set outcome to revealed on an active round', async () => {
      startRound('France');
      const result = revealRoundAnswer();
      expect(result.changed).toBe(true);
      expect(result.outcome).toBe('revealed');
    });

    it('should return changed: false on a finished round', async () => {
      const france = makeCountry('France');
      await seedStore(france);
      startRound('France');
      submitRoundGuess('France'); // won
      const result = revealRoundAnswer();
      expect(result.changed).toBe(false);
    });
  });
});
