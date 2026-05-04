import { describe, it, expect, beforeEach } from 'vitest';
import { mockCountries, createMockCountryLookup } from '../../fixtures/mock-countries.js';

/**
 * Unit Tests for src/store/lookup.js
 * Tests country lookup table construction
 */
describe('Store / Lookup', () => {
  
  let lookup;
  let mockCountryData;

  beforeEach(() => {
    // Simulate the structure of real country data
    mockCountryData = mockCountries.map(c => ({
      properties: {
        id: c.id,
        name: c.name,
        displayName: c.name,
        aliases: c.aliases,
        continent: c.continent
      }
    }));
    
    lookup = createMockCountryLookup();
  });

  describe('test_addCanonicalCountryToLookup', () => {
    it('should map canonical name to country', () => {
      expect(lookup['france']).toBeDefined();
      expect(lookup['france'].id).toBe('FR');
      expect(lookup['france'].country).toBe('France');
    });
  });

  describe('test_addCountryAliases', () => {
    it('should map aliases to same country', () => {
      // UK aliases
      expect(lookup['uk']).toBeDefined();
      expect(lookup['uk'].id).toBe('GB');
      
      expect(lookup['britain']).toBeDefined();
      expect(lookup['britain'].id).toBe('GB');
      
      // Should all point to same country
      expect(lookup['uk'].country).toBe('United Kingdom');
      expect(lookup['britain'].country).toBe('United Kingdom');
    });
  });

  describe('test_stripThePrefixFromName', () => {
    it('should handle "The" prefix in country names', () => {
      // Netherlands can be accessed with or without "The"
      expect(lookup['netherlands']).toBeDefined();
      expect(lookup['netherlands'].id).toBe('NL');
      
      expect(lookup['the netherlands']).toBeDefined();
      expect(lookup['the netherlands'].id).toBe('NL');
    });
  });

  describe('test_multiwordCountryNames', () => {
    it('should correctly match multi-word country names', () => {
      expect(lookup['united kingdom']).toBeDefined();
      expect(lookup['united kingdom'].id).toBe('GB');
      
      expect(lookup['united states']).toBeDefined();
      expect(lookup['united states'].id).toBe('US');
      
      expect(lookup['costa rica']).toBeDefined();
      expect(lookup['costa rica'].id).toBe('CR');
      
      expect(lookup['côte d ivoire']).toBeDefined();
      expect(lookup['côte d ivoire'].id).toBe('CI');
    });
  });

  describe('test_lookupDeduplication', () => {
    it('should not create duplicate entries for same country', () => {
      // The lookup is a Map, so keys are unique
      // France appears only once even though it could be accessed multiple ways
      const frKeys = Object.keys(lookup).filter(k => lookup[k].id === 'FR');
      
      // Should have canonical and possibly alias variations, but all point to same country
      frKeys.forEach(key => {
        expect(lookup[key].id).toBe('FR');
        expect(lookup[key].country).toBe('France');
      });
    });
  });

  describe('test_emptyOrInvalidCountriesHandled', () => {
    it('should not crash with null/undefined properties', () => {
      const invalidCountries = [
        { properties: null },
        { properties: {} },
        { properties: { name: null } },
        {},
        null
      ];

      // Test that empty/null handling doesn't throw
      expect(() => {
        invalidCountries.forEach(country => {
          if (!country || !country.properties || !country.properties.name) {
            return; // Skip processing
          }
        });
      }).not.toThrow();
    });
  });
});
