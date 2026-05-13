/**
 * @fileoverview Core state engine: initial state, reducer, dispatch, and the
 * read-only state proxy.
 */
import { worldleLiteLogger as log } from '../app/logger.js';
import { STATE_ACTIONS, ROUND_OUTCOME } from './constants.js';

function createInitialRoundState() {
  return {
    outcome: ROUND_OUTCOME.active,
    targetName: null,
    missesUsed: 0,
    guesses: [],
    hintLevel: 0,
    revealedHints: [],
  };
}

let currentState = {
  countriesData: [],
  countryNames: [],
  countryByName: new Map(),
  countryByGuess: new Map(),
  countryByLooseGuess: new Map(),
  countryLookupEntries: [],
  targetCountry: null,
  selectedIndex: -1,
  selectedContinent: null,
  numCorrect: 0,
  numPlayed: 0,
  numHintsUsed: 0,
  hasShownFirstRound: false,
  round: createInitialRoundState(),
};

function reducer(state, action) {
  switch (action.type) {
    case STATE_ACTIONS.loadCountries:
      return {
        ...state,
        countriesData: action.countriesData,
        countryNames: action.countryNames,
        countryByName: action.countryByName,
        countryByGuess: action.countryByGuess,
        countryByLooseGuess: action.countryByLooseGuess,
        countryLookupEntries: action.countryLookupEntries,
      };
    case STATE_ACTIONS.setSelectedIndex:
      return {
        ...state,
        selectedIndex: action.selectedIndex,
      };
    case STATE_ACTIONS.setTargetCountry:
      return {
        ...state,
        targetCountry: action.targetCountry,
      };
    case STATE_ACTIONS.showFirstRound:
      return {
        ...state,
        hasShownFirstRound: true,
      };
    case STATE_ACTIONS.incrementCorrect:
      return {
        ...state,
        numCorrect: state.numCorrect + 1,
      };
    case STATE_ACTIONS.incrementPlayed:
      return {
        ...state,
        numPlayed: state.numPlayed + 1,
      };
    case STATE_ACTIONS.incrementHintsUsed:
      return {
        ...state,
        numHintsUsed: state.numHintsUsed + 1,
      };
    case STATE_ACTIONS.resetScores:
      return {
        ...state,
        numCorrect: 0,
        numPlayed: 0,
        numHintsUsed: 0,
      };
    case STATE_ACTIONS.setSelectedContinent:
      return {
        ...state,
        selectedContinent: action.selectedContinent,
      };
    case STATE_ACTIONS.setRoundState:
      return {
        ...state,
        round: action.round,
      };
    default:
      // Unknown action: preserve existing state.
      return state;
  }
}

export function dispatch(action) {
  log.debug('[store] dispatch', action && action.type ? action.type : action, action);

  currentState = reducer(currentState, action);

  // Log a small snapshot of the resulting state for quick debugging
  log.debug('[store] newState', {
    numCorrect: currentState.numCorrect,
    numPlayed: currentState.numPlayed,
    selectedContinent: currentState.selectedContinent,
    round: currentState.round && {
      outcome: currentState.round.outcome,
      missesUsed: currentState.round.missesUsed,
    },
  });

  return currentState;
}

export function getCurrentState() {
  return currentState;
}

const stateProxy = new Proxy(
  {},
  {
    get(_target, property) {
      return currentState[property];
    },
    set() {
      return false;
    },
    has(_target, property) {
      return property in currentState;
    },
    ownKeys() {
      return Reflect.ownKeys(currentState);
    },
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = Object.getOwnPropertyDescriptor(currentState, property);
      if (!descriptor) {
        return undefined;
      }

      return {
        configurable: true,
        enumerable: true,
        value: currentState[property],
        writable: false,
      };
    },
  }
);

export { stateProxy as state };


