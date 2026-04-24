/**
 * @fileoverview Shared configuration for Worldle Lite.
 *
 * All values that control gameplay rules, copy strings, GeoJSON source-field
 * mappings, and UI timings live here so they can be changed in one place.
 *
 * Exposed globally as {@link window.gameConfig}.
 */
window.gameConfig = {
  W: 960,
  H: 500,
  DEBUG: true,
  DEBUG_STORAGE_KEY: "worldle-lite-debug",
  AUTO_ADVANCE_STORAGE_KEY: "worldle-lite-auto-advance",
  THEME_STORAGE_KEY: "worldle-lite-theme",
  COUNTRIES_GEOJSON_URL: "data/world-countries.json",
  COUNTRY_NAME_PROPERTY: "NAME_EN",
  COUNTRY_CONTINENT_PROPERTY: "CONTINENT",
  COUNTRY_CONTINENT_MEMBERSHIPS: new Map([
    ["russia", ["Europe", "Asia"]]
  ]),
  MAX_MISSES_PER_ROUND: 3,
  MAX_HINTS_PER_ROUND: 3,
  MAX_SUGGESTIONS: 6,
  ROUND_ADVANCE_MS: {
    correct: 2000,
    reveal: 2400,
    miss: 2600
  },
  COPY: {
    pageTitle: "Worldle Lite",
    hero: {
      eyebrow: "Geography guessing game",
      title: "Worldle Lite",
      subtitle: "Guess the country highlighted on the map. Each round gives you three distinct misses, and revealing the answer leaves the round revealed until you start a new game.",
      misses: "3 guesses per round",
      autocomplete: "Autocomplete suggestions",
      reveal: "Reveal to show the answer"
    },
    themeToggle: {
      lightText: "Light mode",
      darkText: "Dark mode",
      lightAriaLabel: "Switch to light mode",
      darkAriaLabel: "Switch to dark mode"
    },
    input: {
      idlePlaceholder: "Type a country name...",
      lockedPlaceholder: "Loading the next country..."
    },
    buttons: {
      hint: "Hint",
      showAnswer: "Reveal",
      replayHalo: "Replay halo",
      autoAdvance: "Auto-advance",
      nextRound: "Next round",
      reset: "New game"
    },
    hints: {
      flag: "Flag: {flag}",
      firstLetter: "Give it a shot — this country starts with {letter}.",
      letterCount: "This might help -- {count} letters.",
      separator: "\n"
    },
    reveal: {
      answerPrefix: "Answer: "
    },
    feedback: {
      correct: "✓ Correct!",
      answerShown: "✕ Answer revealed.",
      outOfGuesses: "✕ Three misses — try again.",
      wrongPrefix: "✕ Not this one — ",
      wrongSuffix: " guesses left."
    },
    transitions: {
      loadingNextCountry: "Loading next country"
    }
  }
};
