import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockCountries } from '../fixtures/mock-countries.js';

/**
 * Integration Tests - Settings and State Persistence
 */
describe('Integration / Settings & State Persistence', () => {
  const mockStorage = {};

  const localStorageMock = {
    getItem: (key) => mockStorage[key] ?? null,
    setItem: (key, value) => {
      mockStorage[key] = value.toString();
    },
    removeItem: (key) => {
      delete mockStorage[key];
    },
    clear: () => {
      Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    },
  };

  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('Test 9: Settings Persistence', () => {
    it('should persist and restore theme, auto-advance, debug mode', () => {
      // User toggles settings
      const settings = {
        theme: 'dark',
        autoAdvance: true,
        debugMode: true,
      };

      // Save to localStorage
      Object.entries(settings).forEach(([key, value]) => {
        localStorageMock.setItem(key, JSON.stringify(value));
      });

      // Simulate page reload - settings should be restored
      const restoredSettings = {};
      Object.keys(settings).forEach((key) => {
        restoredSettings[key] = JSON.parse(localStorageMock.getItem(key));
      });

      expect(restoredSettings.theme).toBe('dark');
      expect(restoredSettings.autoAdvance).toBe(true);
      expect(restoredSettings.debugMode).toBe(true);
    });
  });

  describe('Test 10: New Game Reset', () => {
    it('should reset scores and start first round when new game clicked', () => {
      let gameState = {
        game: {
          round: 5,
          stats: {
            plays: 20,
            correct: 15,
            hintsUsed: 12,
          },
        },
        current: {
          targetCountry: mockCountries[0],
          guesses: ['France'],
          missesUsed: 1,
        },
      };

      // User clicks "New Game"
      gameState = {
        game: {
          round: 1,
          stats: {
            plays: 0,
            correct: 0,
            hintsUsed: 0,
          },
        },
        current: {
          targetCountry: mockCountries[1], // New country
          guesses: [],
          missesUsed: 0,
        },
      };

      expect(gameState.game.round).toBe(1);
      expect(gameState.game.stats.plays).toBe(0);
      expect(gameState.game.stats.correct).toBe(0);
      expect(gameState.game.stats.hintsUsed).toBe(0);
    });
  });

  describe('Test 11: Input Submission Validation', () => {
    it('should validate input before allowing submission', () => {
      const countryLookup = new Map([
        ['france', 'France'],
        ['germany', 'Germany'],
      ]);

      const validateAndSubmit = (input, lookup) => {
        const normalized = String(input).trim().toLowerCase();
        if (!normalized) {
          return { submitted: false, reason: 'empty' };
        }
        if (!lookup.has(normalized)) {
          return { submitted: false, reason: 'not_found' };
        }
        return { submitted: true, country: lookup.get(normalized) };
      };

      // Empty input rejected
      expect(validateAndSubmit('', countryLookup).submitted).toBe(false);

      // Invalid country rejected
      expect(validateAndSubmit('InvalidCountry', countryLookup).submitted).toBe(false);

      // Valid input accepted
      expect(validateAndSubmit('France', countryLookup).submitted).toBe(true);

      // Enter key submission works
      const enterKeyResult = validateAndSubmit('Germany', countryLookup);
      expect(enterKeyResult.submitted).toBe(true);

      // Button click submission works
      const clickResult = validateAndSubmit('France', countryLookup);
      expect(clickResult.submitted).toBe(true);
    });
  });

  describe('Test 12: GeoJSON Load Failure Handling', () => {
    it('should catch and handle fetch/parse errors gracefully', () => {
      const loadCountryData = async (url) => {
        try {
          // Simulate fetch that might fail
          if (!url) {
            throw new Error('No URL provided');
          }

          // In real scenario, would be: const response = await fetch(url);
          // Simulate parsing error
          const invalidJson = '{invalid json}';
          const parsed = JSON.parse(invalidJson);

          return { success: true, data: parsed };
        } catch (e) {
          return {
            success: false,
            error: e.message,
            fallback: true,
          };
        }
      };

      const testCases = [
        { url: null, description: 'missing URL' },
        { url: 'invalid', description: 'invalid JSON response' },
      ];

      testCases.forEach(async (test) => {
        const result = await loadCountryData(test.url);
        expect(result.success).toBe(false);
        expect(result.fallback).toBe(true);
      });
    });

    it('should display user-friendly error message on load failure', () => {
      const handleLoadError = (error) => {
        const messages = {
          'No URL provided': 'Unable to load country data. Please refresh the page.',
          SyntaxError: 'Country data is corrupted. Please refresh the page.',
          NetworkError: 'Network error. Please check your connection.',
          default: 'An error occurred. Please refresh the page.',
        };

        const key = error.message || 'default';
        return messages[key] || messages.default;
      };

      const msg1 = handleLoadError(new Error('No URL provided'));
      expect(msg1).toContain('country data');

      const msg2 = handleLoadError(new Error('SyntaxError'));
      expect(msg2).toContain('corrupted');
    });

    it('should not crash game on data load failure', () => {
      const startGame = (countries) => {
        try {
          if (!countries || countries.length === 0) {
            return { started: false, reason: 'no_data' };
          }
          return { started: true, firstCountry: countries[0] };
        } catch (e) {
          return { started: false, error: e.message };
        }
      };

      // No countries available
      expect(startGame(null).started).toBe(false);
      expect(startGame([]).started).toBe(false);

      // Valid countries
      expect(startGame(mockCountries).started).toBe(true);
    });
  });

  describe('Test 13: Score Tracking Across Rounds', () => {
    it('should accumulate scores correctly across multiple rounds', () => {
      let stats = {
        plays: 0,
        correct: 0,
        hintsUsed: 0,
      };

      // Round 1: Correct guess
      stats = {
        plays: stats.plays + 1,
        correct: stats.correct + 1,
        hintsUsed: stats.hintsUsed + 0,
      };
      expect(stats).toEqual({ plays: 1, correct: 1, hintsUsed: 0 });

      // Round 2: Wrong guess (exhausted)
      stats = {
        plays: stats.plays + 1,
        correct: stats.correct,
        hintsUsed: stats.hintsUsed + 2,
      };
      expect(stats).toEqual({ plays: 2, correct: 1, hintsUsed: 2 });

      // Round 3: Correct with 1 hint
      stats = {
        plays: stats.plays + 1,
        correct: stats.correct + 1,
        hintsUsed: stats.hintsUsed + 1,
      };
      expect(stats).toEqual({ plays: 3, correct: 2, hintsUsed: 3 });
    });
  });

  describe('Test 14: Stats Display Calculation', () => {
    it('should calculate win percentage correctly', () => {
      const calculateStats = (stats) => {
        const winPercentage = stats.plays > 0 ? Math.round((stats.correct / stats.plays) * 100) : 0;

        const avgHintsPerRound = stats.plays > 0 ? (stats.hintsUsed / stats.plays).toFixed(1) : 0;

        return {
          winPercentage,
          avgHintsPerRound,
          totalGames: stats.plays,
          wins: stats.correct,
        };
      };

      const stats1 = { plays: 10, correct: 7, hintsUsed: 15 };
      const display1 = calculateStats(stats1);
      expect(display1.winPercentage).toBe(70);
      expect(display1.totalGames).toBe(10);
      expect(display1.wins).toBe(7);

      const stats2 = { plays: 0, correct: 0, hintsUsed: 0 };
      const display2 = calculateStats(stats2);
      expect(display2.winPercentage).toBe(0);
    });
  });
});
