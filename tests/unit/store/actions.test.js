/**
 * Tests for src/store/actions.js — imports and exercises the REAL module.
 *
 * Each test resets modules so it gets a fresh store instance.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

function makeCountry(name, aliases = []) {
  return {
    properties: { name, displayName: name, aliases },
  };
}

async function freshModules() {
  vi.resetModules();
  const reducerMod = await import('../../../src/store/reducer.js');
  const actionsMod = await import('../../../src/store/actions.js');
  return { reducerMod, actionsMod };
}

describe('Store / Actions (real)', () => {
  describe('setTargetCountry', () => {
    it('should update targetCountry in state', async () => {
      const { reducerMod, actionsMod } = await freshModules();
      const france = makeCountry('France');
      actionsMod.setTargetCountry(france);
      expect(reducerMod.getCurrentState().targetCountry).toBe(france);
    });

    it('should accept null to clear the target country', async () => {
      const { reducerMod, actionsMod } = await freshModules();
      actionsMod.setTargetCountry(makeCountry('France'));
      actionsMod.setTargetCountry(null);
      expect(reducerMod.getCurrentState().targetCountry).toBeNull();
    });
  });

  describe('incrementCorrect / incrementPlayed / resetScores', () => {
    it('should increment numCorrect', async () => {
      const { reducerMod, actionsMod } = await freshModules();
      const before = reducerMod.getCurrentState().numCorrect ?? 0;
      actionsMod.incrementCorrect();
      expect(reducerMod.getCurrentState().numCorrect).toBe(before + 1);
    });

    it('should increment numPlayed', async () => {
      const { reducerMod, actionsMod } = await freshModules();
      const before = reducerMod.getCurrentState().numPlayed ?? 0;
      actionsMod.incrementPlayed();
      expect(reducerMod.getCurrentState().numPlayed).toBe(before + 1);
    });

    it('should reset numCorrect and numPlayed to 0', async () => {
      const { reducerMod, actionsMod } = await freshModules();
      actionsMod.incrementCorrect();
      actionsMod.incrementPlayed();
      actionsMod.resetScores();
      const state = reducerMod.getCurrentState();
      expect(state.numCorrect).toBe(0);
      expect(state.numPlayed).toBe(0);
    });
  });

  describe('incrementHintsUsed', () => {
    it('should increment numHintsUsed in state', async () => {
      const { reducerMod, actionsMod } = await freshModules();
      const before = reducerMod.getCurrentState().numHintsUsed ?? 0;
      actionsMod.incrementHintsUsed();
      expect(reducerMod.getCurrentState().numHintsUsed).toBe(before + 1);
    });
  });

  describe('setSelectedIndex', () => {
    it('should update selectedIndex in state', async () => {
      const { reducerMod, actionsMod } = await freshModules();
      actionsMod.setSelectedIndex(3);
      expect(reducerMod.getCurrentState().selectedIndex).toBe(3);
    });

    it('should not dispatch when the same index is already set', async () => {
      const { reducerMod, actionsMod } = await freshModules();
      actionsMod.setSelectedIndex(2);
      const dispatchSpy = vi.spyOn(reducerMod, 'dispatch');
      actionsMod.setSelectedIndex(2);
      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should accept -1 to clear selection', async () => {
      const { reducerMod, actionsMod } = await freshModules();
      actionsMod.setSelectedIndex(5);
      actionsMod.setSelectedIndex(-1);
      expect(reducerMod.getCurrentState().selectedIndex).toBe(-1);
    });
  });

  describe('setSelectedContinent', () => {
    it('should update selectedContinent in state', async () => {
      const { reducerMod, actionsMod } = await freshModules();
      actionsMod.setSelectedContinent('Europe');
      expect(reducerMod.getCurrentState().selectedContinent).toBe('Europe');
    });

    it('should accept null to clear continent filter', async () => {
      const { reducerMod, actionsMod } = await freshModules();
      actionsMod.setSelectedContinent('Africa');
      actionsMod.setSelectedContinent(null);
      expect(reducerMod.getCurrentState().selectedContinent).toBeNull();
    });
  });

  describe('loadCountriesIntoState', () => {
    it('should populate countriesData and countryNames', async () => {
      const { reducerMod, actionsMod } = await freshModules();
      const countries = [makeCountry('France'), makeCountry('Germany')];
      actionsMod.loadCountriesIntoState({
        countriesData: countries,
        countryNames: countries.map((c) => c.properties.name),
        countryByName: new Map(countries.map((c) => [c.properties.name.toLowerCase(), c])),
      });
      const state = reducerMod.getCurrentState();
      expect(state.countriesData).toHaveLength(2);
      expect(state.countryNames).toContain('France');
      expect(state.countryNames).toContain('Germany');
    });

    it('should build countryByGuess lookup entries', async () => {
      const { reducerMod, actionsMod } = await freshModules();
      const usa = makeCountry('United States', ['USA', 'America']);
      actionsMod.loadCountriesIntoState({
        countriesData: [usa],
        countryNames: ['United States'],
        countryByName: new Map([['united states', usa]]),
      });
      const state = reducerMod.getCurrentState();
      expect(state.countryByGuess).toBeDefined();
      // Should be able to look up by alias key
      expect(state.countryByGuess.size).toBeGreaterThan(0);
    });
  });
});
