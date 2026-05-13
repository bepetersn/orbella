import { describe, it, expect } from 'vitest';
import { gameConfig } from '../../src/config.js';
import { STATE_ACTIONS, ROUND_OUTCOME } from '../../src/store/constants.js';

/**
 * Unit Tests for src/config.js and src/store/constants.js
 * Tests configuration and game constants
 */
describe('Config / Constants', () => {
  describe('test_config_roundAdvanceTiming', () => {
    it('should have positive timing values for round transitions', () => {
      expect(gameConfig.ROUND_ADVANCE_MS.correct).toBeGreaterThan(0);
      expect(gameConfig.ROUND_ADVANCE_MS.reveal).toBeGreaterThan(0);
      expect(gameConfig.ROUND_ADVANCE_MS.miss).toBeGreaterThan(0);
    });

    it('should have reasonable timing ranges (100–5000 ms)', () => {
      Object.values(gameConfig.ROUND_ADVANCE_MS).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(100);
        expect(value).toBeLessThanOrEqual(5000);
      });
    });

    it('should maintain consistent timing hierarchy: correct < miss', () => {
      // A correct-guess transition should feel snappier than the miss delay
      expect(gameConfig.ROUND_ADVANCE_MS.correct).toBeLessThan(gameConfig.ROUND_ADVANCE_MS.miss);
    });
  });

  describe('test_config_maxMissesAndHints', () => {
    it('should have valid max misses and hints values', () => {
      expect(gameConfig.MAX_MISSES_PER_ROUND).toBe(3);
      expect(gameConfig.MAX_HINTS_PER_ROUND).toBe(3);
    });

    it('should enforce max values are positive integers', () => {
      expect(gameConfig.MAX_MISSES_PER_ROUND).toBeGreaterThan(0);
      expect(gameConfig.MAX_HINTS_PER_ROUND).toBeGreaterThan(0);
      expect(Number.isInteger(gameConfig.MAX_MISSES_PER_ROUND)).toBe(true);
      expect(Number.isInteger(gameConfig.MAX_HINTS_PER_ROUND)).toBe(true);
    });

    it('should have a positive MAX_SUGGESTIONS', () => {
      expect(gameConfig.MAX_SUGGESTIONS).toBeGreaterThan(0);
      expect(Number.isInteger(gameConfig.MAX_SUGGESTIONS)).toBe(true);
    });
  });

  describe('test_config_roundOutcomes', () => {
    it('should define all required round outcomes with correct string values', () => {
      expect(ROUND_OUTCOME.active).toBe('active');
      expect(ROUND_OUTCOME.won).toBe('won');
      expect(ROUND_OUTCOME.revealed).toBe('revealed');
      expect(ROUND_OUTCOME.missed).toBe('missed');
    });

    it('should export exactly the expected set of outcome keys', () => {
      expect(Object.keys(ROUND_OUTCOME).sort()).toEqual(['active', 'missed', 'revealed', 'won']);
    });
  });

  describe('test_config_stateActions', () => {
    it('should define all required state actions', () => {
      expect(STATE_ACTIONS.loadCountries).toBeDefined();
      expect(STATE_ACTIONS.setTargetCountry).toBeDefined();
      expect(STATE_ACTIONS.incrementCorrect).toBeDefined();
      expect(STATE_ACTIONS.resetScores).toBeDefined();
      expect(STATE_ACTIONS.setRoundState).toBeDefined();
      expect(STATE_ACTIONS.incrementHintsUsed).toBeDefined();
      expect(STATE_ACTIONS.setSelectedContinent).toBeDefined();
    });

    it('should use string values for every action key', () => {
      Object.entries(STATE_ACTIONS).forEach(([key, value]) => {
        expect(typeof value, `STATE_ACTIONS.${key}`).toBe('string');
        expect(value.length, `STATE_ACTIONS.${key} must be non-empty`).toBeGreaterThan(0);
      });
    });
  });

  describe('test_config_buildId', () => {
    it('should expose BUILD_ID as a string (falls back to empty string outside Vite)', () => {
      // __BUILD_ID__ is not defined by Vitest, so the typeof guard in config.js
      // should produce an empty string rather than throwing a ReferenceError.
      expect(typeof gameConfig.BUILD_ID).toBe('string');
    });

    it('should fall back to an empty string in the test environment', () => {
      // Vitest does not inject __BUILD_ID__, so the fallback branch is taken.
      expect(gameConfig.BUILD_ID).toBe('');
    });
  });
});
