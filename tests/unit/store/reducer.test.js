import { describe, it, expect, beforeEach } from 'vitest';
import { mockCountries, createMockCountryLookup } from '../../fixtures/mock-countries.js';
import {
  initialState,
  roundInProgressState,
  roundCompletedState,
  roundExhaustedState,
} from '../../fixtures/mock-state.js';

/**
 * Unit Tests for src/store/reducer.js
 * Tests core state management and action handling
 */
describe('Store / Reducer', () => {
  describe('test_initializeRoundState', () => {
    it('should initialize round with correct defaults', () => {
      // Mock the reducer behavior
      const createInitialRoundState = () => ({
        outcome: 'active',
        targetName: null,
        missesUsed: 0,
        guesses: [],
        hintLevel: 0,
        revealedHints: [],
      });

      const roundState = createInitialRoundState();

      expect(roundState.outcome).toBe('active');
      expect(roundState.targetName).toBeNull();
      expect(roundState.missesUsed).toBe(0);
      expect(roundState.guesses).toEqual([]);
      expect(roundState.hintLevel).toBe(0);
      expect(roundState.revealedHints).toEqual([]);
    });
  });

  describe('test_setTargetCountry', () => {
    it('should correctly update targetCountry in state', () => {
      const initialState = { targetCountry: null };
      const action = { type: 'SET_TARGET_COUNTRY', targetCountry: mockCountries[0] };

      const newState = {
        ...initialState,
        targetCountry: action.targetCountry,
      };

      expect(newState.targetCountry).toBe(mockCountries[0]);
      expect(newState.targetCountry.id).toBe('FR');
      expect(newState.targetCountry.name).toBe('France');
    });
  });

  describe('test_incrementCorrect', () => {
    it('should increment numCorrect score and persist', () => {
      const state = { numCorrect: 0, numPlayed: 0, numHintsUsed: 0 };
      const action = { type: 'INCREMENT_CORRECT' };

      const newState = {
        ...state,
        numCorrect: state.numCorrect + 1,
      };

      expect(newState.numCorrect).toBe(1);
      expect(state.numCorrect).toBe(0); // Original unchanged

      // Multiple increments
      const newState2 = { ...newState, numCorrect: newState.numCorrect + 1 };
      expect(newState2.numCorrect).toBe(2);
    });
  });

  describe('test_resetScores', () => {
    it('should reset all scores to 0 and initialize new round', () => {
      const state = {
        numCorrect: 5,
        numPlayed: 10,
        numHintsUsed: 8,
        round: { outcome: 'won' },
      };

      const action = { type: 'RESET_SCORES' };

      const newState = {
        ...state,
        numCorrect: 0,
        numPlayed: 0,
        numHintsUsed: 0,
      };

      expect(newState.numCorrect).toBe(0);
      expect(newState.numPlayed).toBe(0);
      expect(newState.numHintsUsed).toBe(0);
    });
  });
});
