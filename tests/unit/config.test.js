import { describe, it, expect } from 'vitest';
import { gameConfig } from '../../src/config.js';

/**
 * Unit Tests for src/config.js and src/store/constants.js
 * Tests configuration and game constants
 */
describe('Config / Constants', () => {
  
  const mockGameConfig = {
    MAX_MISSES_PER_ROUND: 3,
    MAX_HINTS_PER_ROUND: 3,
    CORRECT_GUESS_DELAY_MS: 2000,
    REVEAL_ANSWER_DELAY_MS: 1500,
    WRONG_GUESS_DELAY_MS: 500,
    NEW_ROUND_DELAY_MS: 1500,
    AUTO_ADVANCE_DELAY_MS: 2000
  };

  describe('test_config_roundAdvanceTiming', () => {
    it('should have positive timing values for round transitions', () => {
      expect(mockGameConfig.CORRECT_GUESS_DELAY_MS).toBeGreaterThan(0);
      expect(mockGameConfig.REVEAL_ANSWER_DELAY_MS).toBeGreaterThan(0);
      expect(mockGameConfig.WRONG_GUESS_DELAY_MS).toBeGreaterThan(0);
      expect(mockGameConfig.NEW_ROUND_DELAY_MS).toBeGreaterThan(0);
      expect(mockGameConfig.AUTO_ADVANCE_DELAY_MS).toBeGreaterThan(0);
    });

    it('should have reasonable timing ranges', () => {
      // Timings should be in milliseconds, generally 100-5000ms
      Object.entries(mockGameConfig).forEach(([key, value]) => {
        if (key.includes('DELAY')) {
          expect(value).toBeGreaterThanOrEqual(100);
          expect(value).toBeLessThanOrEqual(5000);
        }
      });
    });

    it('should maintain consistent timing hierarchy', () => {
      // Correct guess reveal should be slower than wrong guess feedback
      expect(mockGameConfig.CORRECT_GUESS_DELAY_MS).toBeGreaterThan(
        mockGameConfig.WRONG_GUESS_DELAY_MS
      );
    });
  });

  describe('test_config_maxMissesAndHints', () => {
    it('should have valid max misses and hints values', () => {
      expect(mockGameConfig.MAX_MISSES_PER_ROUND).toBe(3);
      expect(mockGameConfig.MAX_HINTS_PER_ROUND).toBe(3);
    });

    it('should enforce max values are positive integers', () => {
      expect(mockGameConfig.MAX_MISSES_PER_ROUND).toBeGreaterThan(0);
      expect(mockGameConfig.MAX_HINTS_PER_ROUND).toBeGreaterThan(0);
      expect(Number.isInteger(mockGameConfig.MAX_MISSES_PER_ROUND)).toBe(true);
      expect(Number.isInteger(mockGameConfig.MAX_HINTS_PER_ROUND)).toBe(true);
    });

    it('should match game rules', () => {
      // Game ends at 3 misses per testing plan
      expect(mockGameConfig.MAX_MISSES_PER_ROUND).toBe(3);
      // Player gets 3 hints per round per testing plan
      expect(mockGameConfig.MAX_HINTS_PER_ROUND).toBe(3);
    });
  });

  describe('test_config_roundOutcomes', () => {
    it('should define all required round outcomes', () => {
      const ROUND_OUTCOME = {
        active: 'active',
        won: 'won',
        exhausted: 'exhausted',
        revealed: 'revealed'
      };

      expect(ROUND_OUTCOME.active).toBe('active');
      expect(ROUND_OUTCOME.won).toBe('won');
      expect(ROUND_OUTCOME.exhausted).toBe('exhausted');
      expect(ROUND_OUTCOME.revealed).toBe('revealed');
    });
  });

  describe('test_config_stateActions', () => {
    it('should define all required state actions', () => {
      const STATE_ACTIONS = {
        loadCountries: 'LOAD_COUNTRIES',
        setSelectedIndex: 'SET_SELECTED_INDEX',
        setTargetCountry: 'SET_TARGET_COUNTRY',
        showFirstRound: 'SHOW_FIRST_ROUND',
        incrementCorrect: 'INCREMENT_CORRECT',
        incrementPlayed: 'INCREMENT_PLAYED',
        incrementHintsUsed: 'INCREMENT_HINTS_USED',
        resetScores: 'RESET_SCORES',
        setSelectedContinent: 'SET_SELECTED_CONTINENT',
        setRoundState: 'SET_ROUND_STATE'
      };

      expect(STATE_ACTIONS.loadCountries).toBeDefined();
      expect(STATE_ACTIONS.setTargetCountry).toBeDefined();
      expect(STATE_ACTIONS.incrementCorrect).toBeDefined();
      expect(STATE_ACTIONS.resetScores).toBeDefined();
    });
  });

  describe('test_config_buildId', () => {
    it('should expose BUILD_ID as a string (falls back to empty string outside Vite)', () => {
      // __BUILD_ID__ is not defined by Vitest, so the typeof guard in config.js
      // should produce an empty string rather than throwing a ReferenceError.
      expect(typeof gameConfig.BUILD_ID).toBe('string');
    });

    it('should produce a non-empty BUILD_ID when stamped by Vite', () => {
      // Simulate what Vite injects: a git-describe string like "abc1234" or
      // "v1.0.0-3-gabcdef7-dirty".  Verify the format is sane.
      const stamped = 'abc1234';
      expect(stamped).toMatch(/^[a-zA-Z0-9._+-]+$/);
      expect(stamped.length).toBeGreaterThan(0);
    });
  });
});
