/**
 * @fileoverview Assembles the public {@link gameStore} API from the
 * sub-modules in store/.
 */
import { state, dispatch } from './reducer.js';
import { STATE_ACTIONS, ROUND_OUTCOME } from './constants.js';
import { normalizeGuess } from './normalize.js';
import { resolveCountryGuess, getSuggestedCountryNames } from './query.js';
import {
  getRoundState,
  startRound,
  revealRoundAnswer,
  requestRoundHint,
  submitRoundGuess
} from './round.js';
import {
  loadCountriesIntoState,
  setSelectedIndex,
  setTargetCountry,
  showFirstRound,
  incrementCorrect,
  incrementPlayed,
  incrementHintsUsed,
  resetScores,
  setSelectedContinent
} from './actions.js';

export const gameStore = {
  state,
  dispatch,
  loadCountriesIntoState,
  setSelectedIndex,
  setTargetCountry,
  showFirstRound,
  incrementCorrect,
  incrementPlayed,
  incrementHintsUsed,
  resetScores,
  setSelectedContinent,
  getRoundState,
  startRound,
  revealRoundAnswer,
  requestRoundHint,
  submitRoundGuess,
  normalizeGuess,
  resolveCountryGuess,
  getSuggestedCountryNames,
  ROUND_OUTCOME,
  ACTIONS: STATE_ACTIONS
};
