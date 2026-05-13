/**
 * Tests for requestRoundHint in src/store/round.js.
 *
 * Isolates the hint subsystem that was uncovered by existing round tests.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

let dispatch, startRound, submitRoundGuess, requestRoundHint, getRoundState;

function makeCountry(name, aliases = [], flagEmoji = '🏳️') {
  return {
    properties: { name, displayName: name, aliases, flagEmoji },
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
}

beforeEach(async () => {
  vi.resetModules();
  const roundMod = await import('../../../src/store/round.js');
  const reducerMod = await import('../../../src/store/reducer.js');
  dispatch = reducerMod.dispatch;
  startRound = roundMod.startRound;
  submitRoundGuess = roundMod.submitRoundGuess;
  requestRoundHint = roundMod.requestRoundHint;
  getRoundState = roundMod.getRoundState;
});

describe('Store / Round Hints (real)', () => {
  describe('requestRoundHint', () => {
    it('should return changed: false when round is not active', async () => {
      const france = makeCountry('France');
      await seedStore(france);
      startRound('France');
      submitRoundGuess('France'); // wins round — round is no longer active
      const result = requestRoundHint();
      expect(result.changed).toBe(false);
    });

    it('should return changed: false when no targetName is set', async () => {
      // Don't call startRound — targetName defaults to empty
      const result = requestRoundHint();
      expect(result.changed).toBe(false);
    });

    it('should grant hint level 1 (flag) on first request', async () => {
      const france = makeCountry('France', [], '🇫🇷');
      await seedStore(france);
      startRound('France');
      const result = requestRoundHint();
      expect(result.changed).toBe(true);
      expect(result.hintLevel).toBe(1);
      expect(result.hint.type).toBe('flag');
      expect(result.hint.value).toBe('🇫🇷');
    });

    it('should grant hint level 2 (first-letter) on second request', async () => {
      const france = makeCountry('France', [], '🇫🇷');
      await seedStore(france);
      startRound('France');
      requestRoundHint(); // level 1
      const result = requestRoundHint(); // level 2
      expect(result.changed).toBe(true);
      expect(result.hintLevel).toBe(2);
      expect(result.hint.type).toBe('first-letter');
      expect(result.hint.value).toBe('F');
    });

    it('should grant hint level 3 (letter-count) on third request', async () => {
      const france = makeCountry('France', [], '🇫🇷');
      await seedStore(france);
      startRound('France');
      requestRoundHint(); // level 1
      requestRoundHint(); // level 2
      const result = requestRoundHint(); // level 3
      expect(result.changed).toBe(true);
      expect(result.hintLevel).toBe(3);
      expect(result.hint.type).toBe('letter-count');
      // 'France' has 6 letters
      expect(result.hint.value).toBe(6);
    });

    it('should return changed: false once max hints are exhausted', async () => {
      const france = makeCountry('France', [], '🇫🇷');
      await seedStore(france);
      startRound('France');
      requestRoundHint();
      requestRoundHint();
      requestRoundHint(); // max (3)
      const result = requestRoundHint(); // should be refused
      expect(result.changed).toBe(false);
      expect(result.hintsRemaining).toBe(0);
    });

    it('should accumulate revealedHints across multiple requests', async () => {
      const france = makeCountry('France', [], '🇫🇷');
      await seedStore(france);
      startRound('France');
      requestRoundHint(); // 1
      requestRoundHint(); // 2
      const state = getRoundState();
      expect(state.revealedHints).toHaveLength(2);
    });

    it('should decrement hintsRemaining with each granted hint', async () => {
      const france = makeCountry('France', [], '🇫🇷');
      await seedStore(france);
      startRound('France');
      const r1 = requestRoundHint();
      expect(r1.hintsRemaining).toBe(2);
      const r2 = requestRoundHint();
      expect(r2.hintsRemaining).toBe(1);
      const r3 = requestRoundHint();
      expect(r3.hintsRemaining).toBe(0);
    });
  });
});
