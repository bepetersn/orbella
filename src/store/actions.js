/**
 * @fileoverview Named action dispatchers for all non-round state changes.
 *
 * Exposes thin `dispatch` wrappers on `window._gameStore`.
 */
import { worldleLiteLogger as log } from '../app/logger.js';
const _store = window._gameStore;
const { dispatch, createCountryGuessLookup, STATE_ACTIONS } = _store;

/**
 * Populate the store with the normalised country data loaded from GeoJSON.
 * @param {{ countriesData: object[], countryNames: string[], countryByName: Map<string, object> }} loadedCountries
 */
export function loadCountriesIntoState(loadedCountries) {
  log.info('[actions] loadCountriesIntoState', { countries: loadedCountries?.countriesData?.length || 0 });
  // Populate the store with the provided country data.
  // (Any previous sentinel-based deduplication removed — bootstrap owns loading.)
  const guessLookup = createCountryGuessLookup(loadedCountries.countriesData, loadedCountries.countryByName);

  dispatch({
    type: STATE_ACTIONS.loadCountries,
    countriesData: loadedCountries.countriesData,
    countryNames: loadedCountries.countryNames,
    countryByName: loadedCountries.countryByName,
    countryByGuess: guessLookup.countryByGuess,
    countryByLooseGuess: guessLookup.countryByLooseGuess,
    countryLookupEntries: guessLookup.countryLookupEntries
  });
}

/**
 * Update the highlighted row index in the autocomplete suggestion list.
 * Pass `-1` to deselect all rows.
 * @param {number} selectedIndex
 */
export function setSelectedIndex(selectedIndex) {
  log.debug('[actions] setSelectedIndex', selectedIndex);
  if (_store.state && _store.state.selectedIndex === selectedIndex) {
    // no-op: same index already set
    return;
  }
  dispatch({ type: STATE_ACTIONS.setSelectedIndex, selectedIndex });
}

/**
 * Set the GeoJSON feature that is the current round's answer.
 * @param {object | null} targetCountry
 */
export function setTargetCountry(targetCountry) {
  log.info('[actions] setTargetCountry', targetCountry && (targetCountry.properties?.name || targetCountry));
  dispatch({ type: STATE_ACTIONS.setTargetCountry, targetCountry });
}

export function showFirstRound() {
  log.debug('[actions] showFirstRound');
  dispatch({ type: STATE_ACTIONS.showFirstRound });
}

export function incrementCorrect() {
  log.debug('[actions] incrementCorrect');
  dispatch({ type: STATE_ACTIONS.incrementCorrect });
}

export function incrementPlayed() {
  log.debug('[actions] incrementPlayed');
  dispatch({ type: STATE_ACTIONS.incrementPlayed });
}

export function incrementHintsUsed() {
  log.debug('[actions] incrementHintsUsed');
  dispatch({ type: STATE_ACTIONS.incrementHintsUsed });
}

/** Reset `numCorrect` and `numPlayed` to 0. */
export function resetScores() {
  log.info('[actions] resetScores');
  dispatch({ type: STATE_ACTIONS.resetScores });
}

/**
 * Store the active continent filter name, or `null` to show all countries.
 * @param {string | null} selectedContinent
 */
export function setSelectedContinent(selectedContinent) {
  log.debug('[actions] setSelectedContinent', selectedContinent);
  dispatch({ type: STATE_ACTIONS.setSelectedContinent, selectedContinent });
}

// Backward-compat shims — remove once all callers use import
window._gameStore.loadCountriesIntoState = loadCountriesIntoState;
window._gameStore.setSelectedIndex = setSelectedIndex;
window._gameStore.setTargetCountry = setTargetCountry;
window._gameStore.showFirstRound = showFirstRound;
window._gameStore.incrementCorrect = incrementCorrect;
window._gameStore.incrementPlayed = incrementPlayed;
window._gameStore.incrementHintsUsed = incrementHintsUsed;
window._gameStore.resetScores = resetScores;
window._gameStore.setSelectedContinent = setSelectedContinent;
