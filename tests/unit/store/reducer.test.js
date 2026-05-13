/**
 * Tests for src/store/reducer.js — imports and exercises the REAL module.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Reset module state between tests so each test gets a fresh store.
let dispatch, getCurrentState;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import('../../../src/store/reducer.js');
  dispatch = mod.dispatch;
  getCurrentState = mod.getCurrentState;
});

describe('Store / Reducer (real)', () => {
  describe('initial state', () => {
    it('should start with empty countries and active round', () => {
      const state = getCurrentState();
      expect(state.countriesData).toEqual([]);
      expect(state.numCorrect).toBe(0);
      expect(state.numPlayed).toBe(0);
      expect(state.round.outcome).toBe('active');
      expect(state.round.missesUsed).toBe(0);
    });
  });

  describe('loadCountries action', () => {
    it('should populate country data in state', () => {
      const fakeCountries = [{ properties: { name: 'France' } }];
      const fakeMap = new Map([['france', fakeCountries[0]]]);
      dispatch({
        type: 'loadCountries',
        countriesData: fakeCountries,
        countryNames: ['France'],
        countryByName: fakeMap,
        countryByGuess: fakeMap,
        countryByLooseGuess: fakeMap,
        countryLookupEntries: [],
      });
      const state = getCurrentState();
      expect(state.countriesData).toHaveLength(1);
      expect(state.countryNames).toContain('France');
    });
  });

  describe('setTargetCountry action', () => {
    it('should update targetCountry', () => {
      const country = { properties: { name: 'Germany' } };
      dispatch({ type: 'setTargetCountry', targetCountry: country });
      expect(getCurrentState().targetCountry).toBe(country);
    });
  });

  describe('incrementCorrect action', () => {
    it('should increment numCorrect', () => {
      dispatch({ type: 'incrementCorrect' });
      expect(getCurrentState().numCorrect).toBe(1);
      dispatch({ type: 'incrementCorrect' });
      expect(getCurrentState().numCorrect).toBe(2);
    });
  });

  describe('incrementPlayed action', () => {
    it('should increment numPlayed', () => {
      dispatch({ type: 'incrementPlayed' });
      expect(getCurrentState().numPlayed).toBe(1);
    });
  });

  describe('incrementHintsUsed action', () => {
    it('should increment numHintsUsed', () => {
      dispatch({ type: 'incrementHintsUsed' });
      expect(getCurrentState().numHintsUsed).toBe(1);
    });
  });

  describe('resetScores action', () => {
    it('should reset numCorrect, numPlayed, numHintsUsed to 0', () => {
      dispatch({ type: 'incrementCorrect' });
      dispatch({ type: 'incrementPlayed' });
      dispatch({ type: 'incrementHintsUsed' });
      dispatch({ type: 'resetScores' });
      const state = getCurrentState();
      expect(state.numCorrect).toBe(0);
      expect(state.numPlayed).toBe(0);
      expect(state.numHintsUsed).toBe(0);
    });
  });

  describe('setSelectedContinent action', () => {
    it('should update selectedContinent', () => {
      dispatch({ type: 'setSelectedContinent', selectedContinent: 'Europe' });
      expect(getCurrentState().selectedContinent).toBe('Europe');
    });
  });

  describe('setSelectedIndex action', () => {
    it('should update selectedIndex', () => {
      dispatch({ type: 'setSelectedIndex', selectedIndex: 3 });
      expect(getCurrentState().selectedIndex).toBe(3);
    });
  });

  describe('showFirstRound action', () => {
    it('should set hasShownFirstRound to true', () => {
      dispatch({ type: 'showFirstRound' });
      expect(getCurrentState().hasShownFirstRound).toBe(true);
    });
  });

  describe('setRoundState action', () => {
    it('should replace round state', () => {
      const newRound = {
        outcome: 'won',
        targetName: 'France',
        missesUsed: 1,
        guesses: ['germany'],
        hintLevel: 0,
        revealedHints: [],
      };
      dispatch({ type: 'setRoundState', round: newRound });
      expect(getCurrentState().round.outcome).toBe('won');
      expect(getCurrentState().round.targetName).toBe('France');
    });
  });

  describe('unknown action', () => {
    it('should preserve state on unknown action type', () => {
      dispatch({ type: 'incrementCorrect' });
      dispatch({ type: '__unknown__' });
      expect(getCurrentState().numCorrect).toBe(1);
    });
  });
});
