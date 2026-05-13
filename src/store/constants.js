/**
 * @fileoverview Store constants: action-type strings and round-outcome enum.
 *
 * Exports `STATE_ACTIONS` and `ROUND_OUTCOME` constants for the store modules.
 */
export const STATE_ACTIONS = {
  loadCountries: 'loadCountries',
  setSelectedIndex: 'setSelectedIndex',
  setTargetCountry: 'setTargetCountry',
  showFirstRound: 'showFirstRound',
  incrementCorrect: 'incrementCorrect',
  incrementPlayed: 'incrementPlayed',
  incrementHintsUsed: 'incrementHintsUsed',
  resetScores: 'resetScores',
  setSelectedContinent: 'setSelectedContinent',
  setRoundState: 'setRoundState',
};

export const ROUND_OUTCOME = {
  active: 'active',
  won: 'won',
  revealed: 'revealed',
  missed: 'missed',
};

