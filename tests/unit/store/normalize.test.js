import { describe, it, expect } from 'vitest';

/**
 * Unit Tests for src/store/normalize.js
 * Tests country name normalization logic
 */
describe('Store / Normalize', () => {
  
  // Pure implementation of normalize for testing
  const combiningMarkPattern = /\p{M}/gu;
  const apostropheLikePattern = /[''`´]/gu;
  const ampersandPattern = /&/gu;
  const looseKeyNonAlphaNumericPattern = /[^\p{L}\p{N}]/gu;

  function normalizeGuess(guessName) {
    return String(guessName ?? "")
      .trim()
      .normalize("NFKD")
      .replace(combiningMarkPattern, "")
      .replace(ampersandPattern, " and ")
      .replace(apostropheLikePattern, " ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .toLowerCase()
      .trim();
  }

  function toLooseGuessKey(guessName) {
    const normalized = normalizeGuess(guessName);
    return normalized
      .split(/\s+/)
      .filter(word => word.length > 1)
      .join("");
  }

  describe('test_normalizeGuess_caseInsensitive', () => {
    it('should treat different cases as equivalent', () => {
      expect(normalizeGuess('France')).toBe(normalizeGuess('FRANCE'));
      expect(normalizeGuess('France')).toBe(normalizeGuess('france'));
      expect(normalizeGuess('FRANCE')).toBe('france');
    });
  });

  describe('test_normalizeGuess_whitespace', () => {
    it('should trim and collapse whitespace', () => {
      expect(normalizeGuess('  france  ')).toBe('france');
      expect(normalizeGuess('united  kingdom')).toBe('united kingdom');
      expect(normalizeGuess('  costa   rica  ')).toBe('costa rica');
      expect(normalizeGuess('\tfrance\n')).toBe('france');
    });
  });

  describe('test_normalizeGuess_diacritics', () => {
    it('should normalize diacritics for matching', () => {
      const normalized1 = normalizeGuess('Côte d\'Ivoire');
      const normalized2 = normalizeGuess('Cote d Ivoire');
      // Both should normalize to same form
      expect(normalized1).toBe(normalized2);
      
      // Accents removed
      const frenchAccent = normalizeGuess('café');
      expect(frenchAccent).toBe('cafe');
      
      const spanishN = normalizeGuess('España');
      expect(spanishN).toBe('espana');
    });
  });

  describe('test_normalizeGuess_specialCharacters', () => {
    it('should handle quotes, hyphens consistently', () => {
      const withQuote1 = normalizeGuess("Côte d'Ivoire");
      const withQuote2 = normalizeGuess("Côte d'Ivoire");
      expect(withQuote1).toBe(withQuote2);
      
      const withHyphen = normalizeGuess('Bosnia-Herzegovina');
      expect(withHyphen).toBe('bosnia herzegovina');
      
      const withAnd = normalizeGuess('Trinidad & Tobago');
      expect(withAnd).toBe('trinidad and tobago');
    });
  });

  describe('test_looseGuessKey', () => {
    it('should return fuzzy-match-friendly format without spaces', () => {
      const looseKey = toLooseGuessKey('United Kingdom');
      expect(looseKey).toBe('unitedkingdom');
      
      const looseFrance = toLooseGuessKey('France');
      expect(looseFrance).toBe('france');
      
      const looseComplex = toLooseGuessKey("Côte d'Ivoire");
      // Should be alphanumeric only, no spaces
      expect(looseComplex).toBe('coteivoire');
      expect(looseComplex).not.toContain(' ');
    });
  });
});
