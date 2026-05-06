/**
 * @fileoverview Store constants: action-type strings and round-outcome enum.
 *
 * Exports `STATE_ACTIONS` and `ROUND_OUTCOME` constants for the store modules.
 * Also initialises `window._gameStore` so that subsequent store modules can
 * attach their functions to it before `store/index.js` assembles the public API.
 */
window._gameStore = window._gameStore || {};

export const STATE_ACTIONS = {
  loadCountries: "loadCountries",
  setSelectedIndex: "setSelectedIndex",
  setTargetCountry: "setTargetCountry",
  showFirstRound: "showFirstRound",
  incrementCorrect: "incrementCorrect",
  incrementPlayed: "incrementPlayed",
  incrementHintsUsed: "incrementHintsUsed",
  resetScores: "resetScores",
  setSelectedContinent: "setSelectedContinent",
  setRoundState: "setRoundState"
};

export const ROUND_OUTCOME = {
  active: "active",
  won: "won",
  revealed: "revealed",
  missed: "missed"
};

// window._gameStore shims — needed by store/index.js which reads them
// from the shared object. Remove when store/index.js is refactored to
// import these directly.
window._gameStore.STATE_ACTIONS = STATE_ACTIONS;
window._gameStore.ROUND_OUTCOME = ROUND_OUTCOME;
