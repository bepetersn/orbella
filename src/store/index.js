/**
 * @fileoverview Assembles the public {@link gameStore} API from the
 * sub-modules in store/.
 */
const _store = window._gameStore;

export const gameStore = {
  state: _store.state,
  dispatch: _store.dispatch,
  loadCountriesIntoState: _store.loadCountriesIntoState,
  setSelectedIndex: _store.setSelectedIndex,
  setTargetCountry: _store.setTargetCountry,
  showFirstRound: _store.showFirstRound,
  incrementCorrect: _store.incrementCorrect,
  incrementPlayed: _store.incrementPlayed,
  incrementHintsUsed: _store.incrementHintsUsed,
  resetScores: _store.resetScores,
  setSelectedContinent: _store.setSelectedContinent,
  getRoundState: _store.getRoundState,
  startRound: _store.startRound,
  revealRoundAnswer: _store.revealRoundAnswer,
  requestRoundHint: _store.requestRoundHint,
  submitRoundGuess: _store.submitRoundGuess,
  normalizeGuess: _store.normalizeGuess,
  resolveCountryGuess: _store.resolveCountryGuess,
  getSuggestedCountryNames: _store.getSuggestedCountryNames,
  ROUND_OUTCOME: _store.ROUND_OUTCOME,
  ACTIONS: _store.STATE_ACTIONS
};
