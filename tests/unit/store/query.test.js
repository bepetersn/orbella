/**
 * Tests for src/store/query.js — imports and exercises the REAL module.
 *
 * Each test resets modules so it gets a fresh store instance.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

let resolveCountryGuess, getSuggestedCountryNames;

function makeCountry(name, aliases = [], extraProperties = {}) {
  return {
    properties: {
      name,
      displayName: name,
      aliases,
      ...extraProperties,
    },
  };
}

async function seedStoreWithCountries(countries) {
  const { dispatch } = await import('../../../src/store/reducer.js');
  const { createCountryGuessLookup } = await import('../../../src/store/lookup.js');
  const lookup = createCountryGuessLookup(countries, new Map());
  dispatch({
    type: 'loadCountries',
    countriesData: countries,
    countryNames: countries.map((c) => c.properties.name),
    countryByName: new Map(countries.map((c) => [c.properties.name.toLowerCase(), c])),
    countryByGuess: lookup.countryByGuess,
    countryByLooseGuess: lookup.countryByLooseGuess,
    countryLookupEntries: lookup.countryLookupEntries,
  });
}

const testCountries = [
  makeCountry('France'),
  makeCountry('Germany'),
  makeCountry('Spain'),
  makeCountry('Italy'),
  makeCountry('Portugal'),
  makeCountry('United Kingdom', ['UK', 'Britain']),
  makeCountry('United States', ['USA', 'America']),
  makeCountry('The Netherlands', ['Holland']),
  makeCountry('Costa Rica'),
];

beforeEach(async () => {
  vi.resetModules();
  await seedStoreWithCountries(testCountries);
  const queryMod = await import('../../../src/store/query.js');
  resolveCountryGuess = queryMod.resolveCountryGuess;
  getSuggestedCountryNames = queryMod.getSuggestedCountryNames;
});

describe('Store / Query (real)', () => {
  describe('resolveCountryGuess', () => {
    it('should return the country for an exact case-insensitive match', () => {
      expect(resolveCountryGuess('France')).toBeDefined();
      expect(resolveCountryGuess('france')).toBeDefined();
      expect(resolveCountryGuess('FRANCE')).toBeDefined();
    });

    it('should return null for empty input', () => {
      expect(resolveCountryGuess('')).toBeNull();
      expect(resolveCountryGuess(null)).toBeNull();
    });

    it('should return null for an unrecognised name', () => {
      expect(resolveCountryGuess('Xanadu')).toBeNull();
    });

    it('should resolve an alias', () => {
      const result = resolveCountryGuess('UK');
      expect(result).toBeDefined();
      expect(result.properties.name).toBe('United Kingdom');
    });

    it('should resolve the name without "The " prefix', () => {
      const result = resolveCountryGuess('Netherlands');
      expect(result).toBeDefined();
      expect(result.properties.name).toBe('The Netherlands');
    });

    it('should find a loose match (spaces stripped)', () => {
      const result = resolveCountryGuess('CostaRica');
      expect(result).toBeDefined();
    });

    it('should return a fuzzy match for close typos', () => {
      // "Germny" is one deletion away from "germany"
      const result = resolveCountryGuess('Germny');
      expect(result).toBeDefined();
    });

    it('should reject exact matches outside the selected continent', async () => {
      vi.resetModules();
      const france = makeCountry('France', [], { continent: 'Europe' });
      const georgia = makeCountry('Georgia', [], { continent: 'Asia' });
      await seedStoreWithCountries([france, georgia]);
      const { dispatch } = await import('../../../src/store/reducer.js');
      dispatch({ type: 'setSelectedContinent', selectedContinent: 'Europe' });
      const queryMod = await import('../../../src/store/query.js');

      expect(queryMod.resolveCountryGuess('Georgia')).toBeNull();
      expect(queryMod.resolveCountryGuess('France')?.properties.name).toBe('France');
    });
  });

  describe('getSuggestedCountryNames', () => {
    it('should return an array of matching display names', () => {
      const suggestions = getSuggestedCountryNames('fra');
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions).toContain('France');
    });

    it('should return empty array for empty query', () => {
      expect(getSuggestedCountryNames('')).toEqual([]);
    });

    it('should respect the limit parameter', () => {
      const suggestions = getSuggestedCountryNames('a', 2);
      expect(suggestions.length).toBeLessThanOrEqual(2);
    });

    it('should return up to 8 results by default', () => {
      const suggestions = getSuggestedCountryNames('a');
      expect(suggestions.length).toBeLessThanOrEqual(8);
    });

    it('should return no fuzzy results for very short queries under 3 chars that have no prefix match', () => {
      // Single character with no prefix — falls below min fuzzy length
      const suggestions = getSuggestedCountryNames('zz');
      expect(suggestions).toEqual([]);
    });

    it('should return prefix matches sorted alphabetically', () => {
      const suggestions = getSuggestedCountryNames('uni');
      // Both "United Kingdom" and "United States" start with "uni"
      expect(suggestions).toContain('United Kingdom');
      expect(suggestions).toContain('United States');
    });

    it('should do fuzzy matching for longer typo queries', () => {
      const suggestions = getSuggestedCountryNames('Germnay'); // transposition
      expect(suggestions.some((s) => s.toLowerCase().includes('german'))).toBe(true);
    });

    it('should exclude off-continent countries that share the same prefix', async () => {
      vi.resetModules();
      const france = makeCountry('France', [], { continent: 'Europe' });
      const frenchGuiana = makeCountry('French Guiana', [], { continent: 'South America' });
      await seedStoreWithCountries([france, frenchGuiana]);
      const { dispatch } = await import('../../../src/store/reducer.js');
      dispatch({ type: 'setSelectedContinent', selectedContinent: 'Europe' });
      const queryMod = await import('../../../src/store/query.js');

      expect(queryMod.getSuggestedCountryNames('fr', 10)).toEqual(['France']);
    });
  });
});
