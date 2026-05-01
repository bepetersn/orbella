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
    try { window.worldleLiteLogger?.info('[actions] loadCountriesIntoState', { countries: loadedCountries?.countriesData?.length || 0 }); } catch (e) {}
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
  function setSelectedIndex(selectedIndex) {
    try { window.worldleLiteLogger?.debug('[actions] setSelectedIndex', selectedIndex); } catch (e) {}
    try {
      if (_store.state && typeof _store.state.selectedIndex !== 'undefined' && _store.state.selectedIndex === selectedIndex) {
        // no-op: same index already set
        return;
      }
    } catch (e) { /* ignore */ }
    dispatch({ type: STATE_ACTIONS.setSelectedIndex, selectedIndex });
  }

  /**
   * Set the GeoJSON feature that is the current round's answer.
   * @param {object | null} targetCountry
   */
  function setTargetCountry(targetCountry) {
    try { window.worldleLiteLogger?.info('[actions] setTargetCountry', targetCountry && (targetCountry.properties?.name || targetCountry)); } catch (e) {}
    dispatch({ type: STATE_ACTIONS.setTargetCountry, targetCountry });
  }

  function showFirstRound() {
    try { window.worldleLiteLogger?.debug('[actions] showFirstRound'); } catch (e) {}
    dispatch({ type: STATE_ACTIONS.showFirstRound });
  }

  function incrementCorrect() {
    try { window.worldleLiteLogger?.debug('[actions] incrementCorrect'); } catch (e) {}
    dispatch({ type: STATE_ACTIONS.incrementCorrect });
  }

  function incrementPlayed() {
    try { window.worldleLiteLogger?.debug('[actions] incrementPlayed'); } catch (e) {}
    dispatch({ type: STATE_ACTIONS.incrementPlayed });
  }

  function incrementHintsUsed() {
    try { window.worldleLiteLogger?.debug('[actions] incrementHintsUsed'); } catch (e) {}
    dispatch({ type: STATE_ACTIONS.incrementHintsUsed });
  }

  /** Reset `numCorrect` and `numPlayed` to 0. */
  function resetScores() {
    try { window.worldleLiteLogger?.info('[actions] resetScores'); } catch (e) {}
    dispatch({ type: STATE_ACTIONS.resetScores });
  }

  /**
   * Store the active continent filter name, or `null` to show all countries.
   * @param {string | null} selectedContinent
   */
  function setSelectedContinent(selectedContinent) {
    try { window.worldleLiteLogger?.debug('[actions] setSelectedContinent', selectedContinent); } catch (e) {}
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
