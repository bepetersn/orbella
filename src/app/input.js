/**
 * @fileoverview Autocomplete input handling and continent filter.
 *
 * Manages the text input field and suggestion dropdown: filtering country
 * names, keyboard navigation, form validation, and continent filter changes.
 * Also populates the continent `<select>` element with options derived from
 * the loaded GeoJSON data.
 *
 * Attaches itself to `runtime.input`.
 */
import { ROUND_OUTCOME } from '../store/constants.js';
import { round } from './round/index.js';
import { getRuntime } from './runtime.js';

const getDom = () => getRuntime().dom ?? {};
const getState = () => getRuntime().state ?? {};
const getConfig = () => getRuntime().config ?? {};
const getActions = () => getRuntime().actions ?? {};
let lastAppliedContinent = null;

export function clearSuggestions() {
  getDom().suggestionsBox.innerHTML = '';
  getDom().suggestionsBox.style.display = 'none';
}

export function syncGuessButtonState(isValidInput = false) {
  if (!getDom().input) {
    return;
  }

  const roundState = getActions().getRoundState(getConfig().MAX_MISSES_PER_ROUND);
  const canSubmit = roundState.outcome === ROUND_OUTCOME.active;
  getDom().input.disabled = !canSubmit;
  getDom().input.classList.toggle(getConfig().IS_VALID_CLASS, canSubmit && isValidInput);
}

export function isCountryInSelectedContinent(country, selectedContinent) {
  if (!selectedContinent) {
    return true;
  }

  const memberships = country?.properties?.continents;
  if (Array.isArray(memberships) && memberships.length > 0) {
    return memberships.includes(selectedContinent);
  }

  return country?.properties?.continent === selectedContinent;
}

function getSuggestionVisuals(countryName) {
  const matchedCountry = getActions().resolveCountryGuess(countryName);
  const properties = matchedCountry?.properties ?? {};

  return {
    displayName: properties.displayName ?? properties.name ?? countryName,
    flagEmoji: properties.flagEmoji ?? null,
  };
}

/**
 * Check whether the current input value exactly matches an eligible country
 * name, update the input's visual validity state, and return the result.
 * @returns {boolean}
 */
export function validateInput() {
  const value = getDom().input.value.trim();
  const isValid = Boolean(getActions().resolveCountryGuess(value));

  syncGuessButtonState(isValid);

  return isValid;
}

export function updateSelection(items) {
  const currentSelectedIndex = getState().store.selectedIndex;
  Array.from(items).forEach((element, index) => {
    element.classList.toggle('selected', index === currentSelectedIndex);
  });
}

/**
 * Render up to `getConfig().MAX_SUGGESTIONS` matching country name suggestions below the input.
 * @param {string} value  Lower-cased, trimmed input text.
 */
export function renderSuggestions(value) {
  clearSuggestions();

  const normalizedValue = getActions().normalizeGuess(value);
  const matches = normalizedValue
    ? getActions()
        .getSuggestedCountryNames(normalizedValue, 24)
        .slice(0, getConfig().MAX_SUGGESTIONS)
    : [];

  matches.forEach((name) => {
    const { displayName, flagEmoji } = getSuggestionVisuals(name);
    const suggestion = document.createElement('div');
    suggestion.className = 'suggestion';
    suggestion.dataset.countryName = name;
    suggestion.setAttribute('role', 'option');
    suggestion.setAttribute('aria-label', displayName);

    if (flagEmoji) {
      const flag = document.createElement('span');
      flag.className = 'suggestion-flag';
      flag.textContent = flagEmoji;
      flag.setAttribute('aria-hidden', 'true');
      suggestion.appendChild(flag);
    }

    const label = document.createElement('span');
    label.className = 'suggestion-name';
    label.textContent = displayName;
    suggestion.appendChild(label);

    suggestion.onclick = () => {
      getDom().input.value = suggestion.dataset.countryName || displayName;
      clearSuggestions();
      validateInput();
      round.submitGuess();
    };
    getDom().suggestionsBox.appendChild(suggestion);
  });

  getDom().suggestionsBox.style.display = matches.length > 0 ? 'block' : 'none';
}

export function handleInputChange() {
  const value = getDom().input.value.trim();
  getActions().setSelectedIndex(-1);
  validateInput();

  if (!value) {
    clearSuggestions();
    return;
  }

  renderSuggestions(value);
}

export function handleInputKeydown(event) {
  const items = getDom().suggestionsBox.children;
  const currentSelectedIndex = getState().store.selectedIndex;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    getActions().setSelectedIndex(Math.min(currentSelectedIndex + 1, items.length - 1));
    updateSelection(items);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    getActions().setSelectedIndex(Math.max(currentSelectedIndex - 1, 0));
    updateSelection(items);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (getState().store.selectedIndex >= 0 && items[getState().store.selectedIndex]) {
      getDom().input.value =
        items[getState().store.selectedIndex].dataset.countryName ||
        items[getState().store.selectedIndex].textContent;
    } else if (items.length > 0) {
      getDom().input.value = items[0].dataset.countryName || items[0].textContent;
    }
    getDom().suggestionsBox.style.display = 'none';
    validateInput();
    round.submitGuess();
  } else if (event.key === 'Escape') {
    if (getDom().suggestionsBox.style.display !== 'none') {
      event.preventDefault();
      clearSuggestions();
      getActions().setSelectedIndex(-1);
      updateSelection(items);
    }
  }
}

export function clearForm() {
  getDom().input.value = '';
  clearSuggestions();
  getActions().setSelectedIndex(-1);
  validateInput();
}

export function bindInputHandlers() {
  const input = getDom().input;
  if (!input) return;
  input.addEventListener('input', handleInputChange);
  input.addEventListener('keydown', handleInputKeydown);
}

function applyContinentSelection() {
  const nextContinent = getDom().continentFilter?.value || null;

  if (nextContinent === lastAppliedContinent) {
    getDom().continentFilter?.blur();
    return;
  }

  lastAppliedContinent = nextContinent;
  getActions().setSelectedContinent(nextContinent);
  getRuntime().worldMapInst?.setRegionFilter(nextContinent);
  getDom().continentFilter?.blur();

  requestAnimationFrame(() => {
    round.resetAll();
  });
}

function getContinentCountryCount(countriesData, continent) {
  if (!continent) {
    return countriesData.length;
  }

  return countriesData.filter((country) => isCountryInSelectedContinent(country, continent)).length;
}

/**
 * Populate the region `<select>` with one `<option>` per continent found in
 * `countriesData`, then listen for selection changes and start a new round
 * whenever the active continent changes.
 * @param {object[]} countriesData  Normalised GeoJSON feature array.
 */
export function populateContinentFilter(countriesData) {
  if (!getDom().continentFilter) {
    return;
  }

  const continents = [
    ...new Set(countriesData.map((c) => c.properties.continent).filter(Boolean)),
  ].sort();
  const continentCounts = new Map(
    continents.map((continent) => [continent, getContinentCountryCount(countriesData, continent)])
  );

  const allContinentsOption = getDom().continentFilter.querySelector('option[value=""]');
  if (allContinentsOption) {
    allContinentsOption.textContent = `All countries (${countriesData.length})`;
  }

  continents.forEach((continent) => {
    const option = document.createElement('option');
    option.value = continent;
    option.textContent = `${continent} (${continentCounts.get(continent)})`;
    getDom().continentFilter.appendChild(option);
  });

  lastAppliedContinent = getDom().continentFilter.value || null;

  getDom().continentFilter.addEventListener('change', applyContinentSelection);
}
