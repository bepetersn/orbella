/**
 * Tests for src/store/lookup.js — imports and exercises the REAL module.
 */
import { describe, it, expect } from 'vitest';
import { createCountryGuessLookup } from '../../../src/store/lookup.js';

function makeCountry(name, aliases = [], extra = {}) {
  return {
    properties: {
      name,
      displayName: name,
      aliases,
      ...extra,
    },
  };
}

describe('Store / Lookup (real)', () => {
  describe('canonical name lookup', () => {
    it('should find a country by its canonical name (case-insensitive)', () => {
      const france = makeCountry('France');
      const { countryByGuess } = createCountryGuessLookup([france], new Map());
      expect(countryByGuess.get('france')).toBe(france);
    });

    it('should return undefined for an unknown name', () => {
      const { countryByGuess } = createCountryGuessLookup([], new Map());
      expect(countryByGuess.get('neverland')).toBeUndefined();
    });
  });

  describe('"The " prefix stripping', () => {
    it('should add a lookup entry without the "The " prefix', () => {
      const netherlands = makeCountry('The Netherlands');
      const { countryByGuess } = createCountryGuessLookup([netherlands], new Map());
      expect(countryByGuess.get('netherlands')).toBe(netherlands);
      expect(countryByGuess.get('the netherlands')).toBe(netherlands);
    });
  });

  describe('aliases', () => {
    it('should map each alias to the same country', () => {
      const uk = makeCountry('United Kingdom', ['UK', 'Britain', 'Great Britain']);
      const { countryByGuess } = createCountryGuessLookup([uk], new Map());
      expect(countryByGuess.get('united kingdom')).toBe(uk);
      expect(countryByGuess.get('uk')).toBe(uk);
      expect(countryByGuess.get('britain')).toBe(uk);
      expect(countryByGuess.get('great britain')).toBe(uk);
    });

    it('should handle countries with no aliases', () => {
      const germany = makeCountry('Germany');
      const { countryByGuess } = createCountryGuessLookup([germany], new Map());
      expect(countryByGuess.get('germany')).toBe(germany);
    });
  });

  describe('countryLookupEntries', () => {
    it('should include an entry for the canonical name', () => {
      const france = makeCountry('France');
      const { countryLookupEntries } = createCountryGuessLookup([france], new Map());
      const keys = countryLookupEntries.map((e) => e.key);
      expect(keys).toContain('france');
    });

    it('should include entries for aliases', () => {
      const usa = makeCountry('United States', ['USA', 'America']);
      const { countryLookupEntries } = createCountryGuessLookup([usa], new Map());
      const keys = countryLookupEntries.map((e) => e.key);
      expect(keys).toContain('usa');
      expect(keys).toContain('america');
    });

    it('should not contain duplicate entry keys', () => {
      const france = makeCountry('France', ['France']); // alias same as canonical
      const { countryLookupEntries } = createCountryGuessLookup([france], new Map());
      const franceEntries = countryLookupEntries.filter((e) => e.key === 'france');
      expect(franceEntries.length).toBe(1);
    });
  });

  describe('loose lookup', () => {
    it('should map a loose key (spaces removed) to the country', () => {
      const costaRica = makeCountry('Costa Rica');
      const { countryByLooseGuess } = createCountryGuessLookup([costaRica], new Map());
      expect(countryByLooseGuess.get('costarica')).toBe(costaRica);
    });
  });

  describe('countryByName override map', () => {
    it('should add entries from the provided countryByName map', () => {
      const country = makeCountry('Japan');
      const override = new Map([['nippon', country]]);
      const { countryByGuess } = createCountryGuessLookup([], override);
      expect(countryByGuess.get('nippon')).toBe(country);
    });
  });

  describe('missing displayName', () => {
    it('should skip countries with no displayName and no name', () => {
      const bad = { properties: {} };
      const { countryLookupEntries } = createCountryGuessLookup([bad], new Map());
      expect(countryLookupEntries).toHaveLength(0);
    });
  });

  describe('multiple countries', () => {
    it('should build a lookup across all provided countries', () => {
      const countries = [makeCountry('France'), makeCountry('Germany'), makeCountry('Spain')];
      const { countryByGuess } = createCountryGuessLookup(countries, new Map());
      expect(countryByGuess.get('france')).toBeDefined();
      expect(countryByGuess.get('germany')).toBeDefined();
      expect(countryByGuess.get('spain')).toBeDefined();
    });
  });
});
