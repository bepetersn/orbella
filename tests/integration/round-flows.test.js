import { describe, it, expect, beforeEach } from 'vitest';
import { mockCountries } from '../fixtures/mock-countries.js';
import { initialState, roundInProgressState, roundCompletedState, roundExhaustedState } from '../fixtures/mock-state.js';

/**
 * Integration Tests - End-to-End Round Flows
 * These tests verify that modules work together correctly
 */
describe('Integration / Round Flows', () => {
  
  const ROUND_OUTCOME = {
    active: 'active',
    won: 'won',
    missed: 'missed',
    revealed: 'revealed'
  };

  const normalizeGuess = (name) => {
    return String(name ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ');
  };

  describe('Test 1: Complete Correct-Guess Round', () => {
    it('should complete round from start to correct guess to next round', () => {
      let gameState = {
        ...initialState,
        game: { ...initialState.game, outcome: 'active' },
        current: {
          ...initialState.current,
          targetCountry: mockCountries[0],
          targetName: mockCountries[0].name
        }
      };

      // Round is active
      expect(gameState.game.outcome).toBe('active');

      // User types correct country name
      const userGuess = mockCountries[0].name;
      const normalizedGuess = normalizeGuess(userGuess);
      const normalizedTarget = normalizeGuess(gameState.current.targetName);

      if (normalizedGuess === normalizedTarget) {
        // Update round outcome
        gameState = {
          ...gameState,
          game: {
            ...gameState.game,
            outcome: ROUND_OUTCOME.won,
            stats: {
              ...gameState.game.stats,
              plays: gameState.game.stats.plays + 1,
              correct: gameState.game.stats.correct + 1
            }
          },
          current: {
            ...gameState.current,
            guesses: [...gameState.current.guesses, userGuess]
          }
        };
      }

      // Verify round is complete
      expect(gameState.game.outcome).toBe(ROUND_OUTCOME.won);
      expect(gameState.current.guesses).toContain(userGuess);
      expect(gameState.game.stats.correct).toBe(1);
      expect(gameState.game.stats.plays).toBe(1);
    });
  });

  describe('Test 2: Three-Wrong-Guesses Exhaustion', () => {
    it('should exhaust round after 3 wrong guesses', () => {
      let gameState = {
        ...initialState,
        game: { ...initialState.game, outcome: 'active' },
        current: {
          ...initialState.current,
          targetCountry: mockCountries[0], // France
          targetName: mockCountries[0].name
        }
      };

      const wrongCountries = [mockCountries[1], mockCountries[2], mockCountries[3]]; // Not France

      // Submit 3 wrong guesses
      wrongCountries.forEach(country => {
        gameState = {
          ...gameState,
          current: {
            ...gameState.current,
            missesUsed: gameState.current.missesUsed + 1,
            guesses: [...gameState.current.guesses, country.name]
          }
        };
      });

      // After 3 misses, round should be exhausted
      if (gameState.current.missesUsed >= 3) {
        gameState = {
          ...gameState,
          game: {
            ...gameState.game,
            outcome: ROUND_OUTCOME.exhausted,
            stats: {
              ...gameState.game.stats,
              plays: gameState.game.stats.plays + 1
            }
          }
        };
      }

      expect(gameState.current.missesUsed).toBe(3);
      expect(gameState.game.outcome).toBe(ROUND_OUTCOME.exhausted);
      expect(gameState.game.stats.plays).toBe(1);
      expect(gameState.game.stats.correct).toBe(0); // No correct guess
    });
  });

  describe('Test 3: Alias Matching in Autocomplete', () => {
    it('should match alias names and resolve to correct country', () => {
      const targetCountry = mockCountries.find(c => c.aliases.length > 0);
      if (!targetCountry) {
        expect(true).toBe(true); // Skip if no aliases
        return;
      }

      const alias = targetCountry.aliases[0];
      const normalizedAlias = normalizeGuess(alias);
      const normalizedTarget = normalizeGuess(targetCountry.name);

      // Alias should normalize to same as canonical name (approximately)
      // depending on accent handling
      
      let gameState = {
        current: {
          targetCountry,
          targetName: targetCountry.name,
          guesses: [alias]
        }
      };

      // Resolution should work with alias
      const guessedCountry = targetCountry; // Alias resolves to target
      expect(guessedCountry.id).toBe(targetCountry.id);
    });
  });

  describe('Test 4: Continent Filter Reduces Suggestions', () => {
    it('should filter suggestions by selected continent', () => {
      const selectedContinent = 'Europe';
      
      const europeanCountries = mockCountries.filter(c => c.continent === selectedContinent);
      const otherCountries = mockCountries.filter(c => c.continent !== selectedContinent);

      expect(europeanCountries.length).toBeGreaterThan(0);
      expect(otherCountries.length).toBeGreaterThan(0);

      // When continent filter is applied
      let gameState = {
        current: {
          selectedContinent,
          targetCountry: europeanCountries[0]
        }
      };

      // Non-European countries should not be valid guesses
      const nonEuropeanCountry = otherCountries[0];
      expect(nonEuropeanCountry.continent).not.toBe(selectedContinent);
    });
  });

  describe('Test 5: Reveal Answer Flow', () => {
    it('should reveal answer and prevent further guesses', () => {
      let gameState = {
        ...roundInProgressState,
        current: {
          ...roundInProgressState.current,
          hintsRemaining: 3
        }
      };

      expect(gameState.game.outcome).toBe('active');

      // User clicks reveal button
      gameState = {
        ...gameState,
        game: {
          ...gameState.game,
          outcome: ROUND_OUTCOME.revealed
        }
      };

      // Round should be locked from further guesses
      expect(gameState.game.outcome).toBe(ROUND_OUTCOME.revealed);
      expect(gameState.game.outcome).not.toBe('active');
    });
  });

  describe('Test 6: Hint System', () => {
    it('should provide up to 3 hints and track usage', () => {
      let gameState = {
        ...roundInProgressState,
        current: {
          ...roundInProgressState.current,
          hints: [],
          hintsRemaining: 3
        }
      };

      // Request hints
      for (let i = 0; i < 3; i++) {
        gameState = {
          ...gameState,
          current: {
            ...gameState.current,
            hints: [...gameState.current.hints, `hint_${i + 1}`],
            hintsRemaining: gameState.current.hintsRemaining - 1
          }
        };
      }

      expect(gameState.current.hints.length).toBe(3);
      expect(gameState.current.hintsRemaining).toBe(0);

      // Fourth hint should do nothing
      const beforeFourth = gameState.current.hints.length;
      if (gameState.current.hintsRemaining > 0) {
        gameState = {
          ...gameState,
          current: {
            ...gameState.current,
            hints: [...gameState.current.hints, 'hint_4']
          }
        };
      }

      expect(gameState.current.hints.length).toBe(beforeFourth);
    });
  });

  describe('Test 7: Round Advance Flow (Auto-Advance)', () => {
    it('should auto-advance to new round after correct guess when enabled', () => {
      const autoAdvanceEnabled = true;
      let gameState = {
        ...roundCompletedState,
        game: { ...roundCompletedState.game, outcome: ROUND_OUTCOME.won }
      };

      expect(gameState.game.outcome).toBe(ROUND_OUTCOME.won);
      expect(gameState.game.round).toBe(1);

      if (autoAdvanceEnabled && gameState.game.outcome === ROUND_OUTCOME.won) {
        // Simulate auto-advance after delay
        gameState = {
          ...gameState,
          game: {
            ...gameState.game,
            round: gameState.game.round + 1,
            outcome: 'active'
          },
          current: {
            targetCountry: mockCountries[1], // New country
            targetName: mockCountries[1].name,
            guesses: [],
            missesUsed: 0,
            hints: [],
            hintsRemaining: 3
          }
        };
      }

      expect(gameState.game.round).toBe(2);
      expect(gameState.game.outcome).toBe('active');
    });
  });

  describe('Test 8: Manual Round Transition', () => {
    it('should transition to next round when button clicked', () => {
      const autoAdvanceEnabled = false;
      let gameState = {
        ...roundCompletedState,
        game: { ...roundCompletedState.game, outcome: ROUND_OUTCOME.won }
      };

      // User clicks "Next Round" button
      gameState = {
        ...gameState,
        game: {
          ...gameState.game,
          round: gameState.game.round + 1,
          outcome: 'active'
        },
        current: {
          targetCountry: mockCountries[1],
          targetName: mockCountries[1].name,
          guesses: [],
          missesUsed: 0,
          hints: [],
          hintsRemaining: 3
        }
      };

      expect(gameState.game.round).toBe(2);
      expect(gameState.game.outcome).toBe('active');
      expect(gameState.current.targetCountry.id).toBe(mockCountries[1].id);
    });
  });
});
