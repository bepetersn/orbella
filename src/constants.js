/**
 * @fileoverview Shared constants for Worldle Lite.
 *
 * Fixed UI values, strings, colors, and other non-configurable constants.
 *
 */

export const gameConstants = {
  // DOM selectors and CSS classes
  MAP_SELECTOR: '#globeViz',
  WRONG_MSG_CLASS: 'wrong-msg',
  FAILURE_MSG_CLASS: 'failure-msg',
  CORRECT_MSG_CLASS: 'correct-msg',
  IS_VALID_CLASS: 'is-valid',
  GUESS_PILL_CLASS: 'guess-pill',

  // Globe canvas background colors by theme
  GLOBE_BACKGROUND: {
    light: 'rgba(210, 225, 240, 1.0)',
    dark: 'rgba(10, 18, 36, 1.0)',
  },

  // Country map colors by theme
  COUNTRY_COLORS: {
    light: {
      fill: '#e8eef5',
      stroke: 'rgba(71, 85, 105, 0.85)',
      correct: '#58b48a',
      wrong: '#ffd4a3',
      wrongStroke: '#ff8c42',
      target: '#dc2626',
    },
    dark: {
      fill: '#3a557d',
      stroke: 'rgba(236, 242, 248, 0.96)',
      correct: '#2f8f6b',
      wrong: '#ffb366',
      wrongStroke: '#ff9500',
      target: '#ef4444',
    },
  },

  // Halo animation settings
  HALO: {
    COLOR: '#dc2626',
    DURATION_MS: 1800,
    MAX_RADIUS: 1.0,
    EASING: 'circleOut',
  },

  // UI copy strings and labels
  COPY: {
    pageTitle: 'Worldle Lite',
    hero: {
      eyebrow: 'Geography guessing game',
      title: 'Worldle Lite',
      subtitle:
        'Guess the country highlighted on the map. Each round gives you three distinct misses, and revealing the answer leaves the round revealed until you start a new game.',
      misses: '3 guesses per round',
      autocomplete: 'Autocomplete suggestions',
      reveal: 'Reveal to show the answer',
    },
    themeToggle: {
      lightText: 'Light mode',
      darkText: 'Dark mode',
      lightAriaLabel: 'Switch to light mode',
      darkAriaLabel: 'Switch to dark mode',
    },
    input: {
      idlePlaceholder: 'Type a country name...',
      lockedPlaceholder: 'Loading the next country...',
    },
    buttons: {
      hint: 'Hint',
      showAnswer: 'Reveal',
      replayHalo: 'Replay halo',
      autoAdvance: 'Auto-advance',
      nextRound: 'Next round',
      reset: 'New game',
    },
    hints: {
      flag: 'Flag: {flag}',
      firstLetter: 'Give it a shot — this country starts with {letter}.',
      letterCount: 'This might help -- {count} letters.',
      separator: '\n',
    },
    reveal: {
      answerPrefix: 'Answer: ',
    },
    feedback: {
      correct: '✓ Correct!',
      answerShown: '✕ Answer revealed.',
      outOfGuesses: '✕ Three misses — try again.',
      wrongPrefix: '✕ Not this one — ',
      wrongSuffix: ' guesses left.',
    },
    transitions: {
      loadingNextCountry: 'Loading next country',
    },
  },
};

/** Named export for the COPY block so callers can import it directly. */
export const COPY = gameConstants.COPY;
