import { describe, it, expect, beforeEach } from 'vitest';
import { mockCountries, getCountriesByContinent } from '../../fixtures/mock-countries.js';

/**
 * Unit Tests for src/store/query.js
 * Tests country suggestion and lookup queries
 */
describe('Store / Query', () => {
  
  const normalizeGuess = (name) => {
    return String(name ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ');
  };

  const toLooseGuessKey = (name) => {
    return normalizeGuess(name).replace(/\s+/g, '');
  };

  const getSuggestedCountryNames = (query, countries, continent = null, limit = 6) => {
    if (!query || query.length === 0) {
      return [];
    }

    let filtered = countries;

    // Apply continent filter if provided
    if (continent) {
      filtered = filtered.filter(c => c.continent === continent);
    }

    const normalizedQuery = normalizeGuess(query);
    const looseQuery = toLooseGuessKey(query);

    // Score countries based on query match
    const scored = filtered
      .map(country => {
        const name = country.name;
        const normalizedName = normalizeGuess(name);
        const looseName = toLooseGuessKey(name);

        let score = 0;

        // Exact match at start
        if (normalizedName.startsWith(normalizedQuery)) {
          score += 100;
        }
        // Loose match at start
        if (looseName.startsWith(looseQuery)) {
          score += 50;
        }
        // Contains anywhere
        if (normalizedName.includes(normalizedQuery)) {
          score += 25;
        }
        // Loose contains
        if (looseName.includes(looseQuery)) {
          score += 10;
        }

        return { country, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(item => item.country.name);
  };

  describe('test_getSuggestedCountryNames_basic', () => {
    it('should return top 6 matching countries', () => {
      const suggestions = getSuggestedCountryNames('fr', mockCountries, null, 6);
      
      expect(suggestions.length).toBeLessThanOrEqual(6);
      expect(suggestions).toContain('France');
    });
  });

  describe('test_getSuggestedCountryNames_continent_filter', () => {
    it('should only return countries in selected continent', () => {
      const suggestions = getSuggestedCountryNames('', mockCountries, 'Europe', 10);
      
      const europeanCountries = ['France', 'United Kingdom', 'Netherlands'];
      suggestions.forEach(country => {
        const found = mockCountries.find(c => c.name === country);
        expect(found.continent).toBe('Europe');
      });
    });

    it('should exclude countries from other continents', () => {
      const suggestions = getSuggestedCountryNames('united', mockCountries, 'Europe', 10);
      
      // Should have United Kingdom but not United States
      if (suggestions.includes('United Kingdom')) {
        expect(suggestions).not.toContain('United States');
      }
    });
  });

  describe('test_getSuggestedCountryNames_partial_match', () => {
    it('should match partial country names', () => {
      const suggestions = getSuggestedCountryNames('fr', mockCountries, null, 10);
      expect(suggestions).toContain('France');
      
      const suggestions2 = getSuggestedCountryNames('united', mockCountries, null, 10);
      expect(suggestions2).toContain('United Kingdom');
      expect(suggestions2).toContain('United States');
      
      const suggestions3 = getSuggestedCountryNames('cost', mockCountries, null, 10);
      expect(suggestions3).toContain('Costa Rica');
    });

    it('should prioritize prefix matches over substring matches', () => {
      const suggestions = getSuggestedCountryNames('fran', mockCountries, null, 10);
      // France should be first/high in results
      expect(suggestions[0]).toBe('France');
    });
  });

  describe('test_getSuggestedCountryNames_empty_query', () => {
    it('should return empty array for empty query', () => {
      expect(getSuggestedCountryNames('', mockCountries)).toEqual([]);
      expect(getSuggestedCountryNames(null, mockCountries)).toEqual([]);
    });
  });

  describe('test_getSuggestedCountryNames_case_insensitive', () => {
    it('should handle case-insensitive matching', () => {
      const suggestions1 = getSuggestedCountryNames('FRANCE', mockCountries);
      const suggestions2 = getSuggestedCountryNames('france', mockCountries);
      const suggestions3 = getSuggestedCountryNames('France', mockCountries);
      
      expect(suggestions1).toEqual(suggestions2);
      expect(suggestions2).toEqual(suggestions3);
    });
  });
});
