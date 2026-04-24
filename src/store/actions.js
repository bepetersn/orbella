/**
 * @fileoverview Named action dispatchers for all non-round state changes.
 *
 * Exposes thin `dispatch` wrappers on `window._gameStore`.
 */
(() => {
  const _store = window._gameStore;
  const { dispatch, createCountryGuessLookup, STATE_ACTIONS } = _store;

  /**
   * Populate the store with the normalised country data loaded from GeoJSON.
   * @param {{ countriesData: object[], countryNames: string[], countryByName: Map<string, object> }} loadedCountries
   */
  function loadCountriesIntoState(loadedCountries) {
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
  function setSelectedIndex(selectedIndex) {
    dispatch({ type: STATE_ACTIONS.setSelectedIndex, selectedIndex });
  }

  /**
   * Set the GeoJSON feature that is the current round's answer.
   * @param {object | null} targetCountry
   */
  function setTargetCountry(targetCountry) {
    dispatch({ type: STATE_ACTIONS.setTargetCountry, targetCountry });
  }

  function showFirstRound() {
    dispatch({ type: STATE_ACTIONS.showFirstRound });
  }

  function incrementCorrect() {
    dispatch({ type: STATE_ACTIONS.incrementCorrect });
  }

  function incrementPlayed() {
    dispatch({ type: STATE_ACTIONS.incrementPlayed });
  }

  function incrementHintsUsed() {
    dispatch({ type: STATE_ACTIONS.incrementHintsUsed });
  }

  /** Reset `numCorrect` and `numPlayed` to 0. */
  function resetScores() {
    dispatch({ type: STATE_ACTIONS.resetScores });
  }

  /**
   * Store the active continent filter name, or `null` to show all continents.
   * @param {string | null} selectedContinent
   */
  function setSelectedContinent(selectedContinent) {
    dispatch({ type: STATE_ACTIONS.setSelectedContinent, selectedContinent });
  }

  _store.loadCountriesIntoState = loadCountriesIntoState;
  _store.setSelectedIndex = setSelectedIndex;
  _store.setTargetCountry = setTargetCountry;
  _store.showFirstRound = showFirstRound;
  _store.incrementCorrect = incrementCorrect;
  _store.incrementPlayed = incrementPlayed;
  _store.incrementHintsUsed = incrementHintsUsed;
  _store.resetScores = resetScores;
  _store.setSelectedContinent = setSelectedContinent;
})();
