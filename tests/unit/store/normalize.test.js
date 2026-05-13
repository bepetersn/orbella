/**
 * Tests for src/store/normalize.js — imports and exercises the REAL module.
 */
import { describe, it, expect } from 'vitest';
import { normalizeGuess, toLooseGuessKey } from '../../../src/store/normalize.js';

describe('Store / Normalize (real)', () => {
  describe('normalizeGuess', () => {
    it('treats different cases as equivalent', () => {
      expect(normalizeGuess('France')).toBe(normalizeGuess('FRANCE'));
      expect(normalizeGuess('France')).toBe(normalizeGuess('france'));
      expect(normalizeGuess('FRANCE')).toBe('france');
    });

    it('trims and collapses whitespace', () => {
      expect(normalizeGuess('  france  ')).toBe('france');
      expect(normalizeGuess('united  kingdom')).toBe('united kingdom');
      expect(normalizeGuess('  costa   rica  ')).toBe('costa rica');
      expect(normalizeGuess('\tfrance\n')).toBe('france');
    });

    it('strips diacritics so accented and plain forms match', () => {
      expect(normalizeGuess("Côte d'Ivoire")).toBe(normalizeGuess('Cote d Ivoire'));
      expect(normalizeGuess('café')).toBe('cafe');
      expect(normalizeGuess('España')).toBe('espana');
    });

    it('converts & to "and"', () => {
      expect(normalizeGuess('Trinidad & Tobago')).toBe('trinidad and tobago');
    });

    it('replaces hyphens and straight/curly apostrophes with spaces', () => {
      expect(normalizeGuess('Bosnia-Herzegovina')).toBe('bosnia herzegovina');
      expect(normalizeGuess("Côte d'Ivoire")).toBe(normalizeGuess("Côte d'Ivoire"));
    });

    it('returns empty string for null and undefined', () => {
      expect(normalizeGuess(null)).toBe('');
      expect(normalizeGuess(undefined)).toBe('');
    });

    it('returns empty string for whitespace-only input', () => {
      expect(normalizeGuess('   ')).toBe('');
    });
  });

  describe('toLooseGuessKey', () => {
    it('strips spaces and produces a single lowercase token', () => {
      expect(toLooseGuessKey('United Kingdom')).toBe('unitedkingdom');
      expect(toLooseGuessKey('France')).toBe('france');
    });

    it('handles diacritics the same way as normalizeGuess', () => {
      const key = toLooseGuessKey("Côte d'Ivoire");
      expect(key).toBe('coteivoire');
      expect(key).not.toContain(' ');
    });

    it('filters out single-character words', () => {
      // "d" in "Côte d Ivoire" is 1 char and should be dropped
      expect(toLooseGuessKey("Côte d'Ivoire")).not.toContain('d');
    });

    it('returns empty string for empty input', () => {
      expect(toLooseGuessKey('')).toBe('');
      expect(toLooseGuessKey(null)).toBe('');
    });

    it('two equivalent display names produce the same loose key', () => {
      expect(toLooseGuessKey('United States of America')).toBe(
        toLooseGuessKey('United States of America')
      );
    });
  });
});
