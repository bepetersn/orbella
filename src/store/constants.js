/**
 * @fileoverview Store constants: action-type strings and round-outcome enum.
 *
 * Initialises `window._gameStore` and attaches `STATE_ACTIONS` and
 * `ROUND_OUTCOME` to it so subsequent store modules can read them.
 */
(() => {
  window._gameStore = window._gameStore || {};
  const _store = window._gameStore;

  _store.STATE_ACTIONS = {
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

  _store.ROUND_OUTCOME = {
    active: "active",
    won: "won",
    revealed: "revealed",
    missed: "missed"
  };
})();
