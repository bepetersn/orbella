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
(() => {
  const runtime = window.worldleLiteRuntime;
  const { dom, state, config, actions } = runtime;
  const ROUND_OUTCOME = runtime.IMPORTS.gameStore.ROUND_OUTCOME;
  let lastAppliedContinent = null;

  function clearSuggestions() {
    dom.suggestionsBox.innerHTML = "";
    dom.suggestionsBox.style.display = "none";
  }

  function syncGuessButtonState(isValidInput = false) {
    if (!dom.input) {
      return;
    }

    const roundState = actions.getRoundState(config.MAX_MISSES_PER_ROUND);
    const canSubmit = roundState.outcome === ROUND_OUTCOME.active;
    dom.input.disabled = !canSubmit;
    dom.input.classList.toggle(config.IS_VALID_CLASS, canSubmit && isValidInput);
  }

  function isCountryInSelectedContinent(country, selectedContinent) {
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
    const matchedCountry = actions.resolveCountryGuess(countryName);
    const properties = matchedCountry?.properties ?? {};

    return {
      displayName: properties.displayName ?? properties.name ?? countryName,
      flagEmoji: properties.flagEmoji ?? null
    };
  }

  /**
   * Check whether the current input value exactly matches an eligible country
   * name, update the input's visual validity state, and return the result.
   * @returns {boolean}
   */
  function validateInput() {
    const value = dom.input.value.trim();
    const isValid = Boolean(actions.resolveCountryGuess(value));

    syncGuessButtonState(isValid);

    return isValid;
  }

  function updateSelection(items) {
    const currentSelectedIndex = state.store.selectedIndex;
    Array.from(items).forEach((element, index) => {
      element.classList.toggle("selected", index === currentSelectedIndex);
    });
  }

  /**
    * Render up to `config.MAX_SUGGESTIONS` matching country name suggestions below the input.
   * @param {string} value  Lower-cased, trimmed input text.
   */
  function renderSuggestions(value) {
    clearSuggestions();

    const normalizedValue = actions.normalizeGuess(value);
    const matches = normalizedValue
      ? actions
        .getSuggestedCountryNames(normalizedValue, 24)
        .filter((countryName) => Boolean(actions.resolveCountryGuess(countryName)))
        .slice(0, config.MAX_SUGGESTIONS)
      : [];

    matches.forEach((name) => {
      const { displayName, flagEmoji } = getSuggestionVisuals(name);
      const suggestion = document.createElement("div");
      suggestion.className = "suggestion";
      suggestion.dataset.countryName = name;
      suggestion.setAttribute("role", "option");
      suggestion.setAttribute("aria-label", displayName);

      if (flagEmoji) {
        const flag = document.createElement("span");
        flag.className = "suggestion-flag";
        flag.textContent = flagEmoji;
        flag.setAttribute("aria-hidden", "true");
        suggestion.appendChild(flag);
      }

      const label = document.createElement("span");
      label.className = "suggestion-name";
      label.textContent = displayName;
      suggestion.appendChild(label);

      suggestion.onclick = () => {
        dom.input.value = suggestion.dataset.countryName || displayName;
        clearSuggestions();
        validateInput();
        runtime.round.submitGuess();
      };
      dom.suggestionsBox.appendChild(suggestion);
    });

    dom.suggestionsBox.style.display = matches.length > 0 ? "block" : "none";
  }

  function handleInputChange() {
    const value = dom.input.value.trim();
    actions.setSelectedIndex(-1);
    validateInput();

    if (!value) {
      clearSuggestions();
      return;
    }

    renderSuggestions(value);
  }

  function handleInputKeydown(event) {
    const items = dom.suggestionsBox.children;
    const currentSelectedIndex = state.store.selectedIndex;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      actions.setSelectedIndex(Math.min(currentSelectedIndex + 1, items.length - 1));
      updateSelection(items);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      actions.setSelectedIndex(Math.max(currentSelectedIndex - 1, 0));
      updateSelection(items);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (state.store.selectedIndex >= 0 && items[state.store.selectedIndex]) {
        dom.input.value = items[state.store.selectedIndex].dataset.countryName || items[state.store.selectedIndex].textContent;
      } else if (items.length > 0) {
        dom.input.value = items[0].dataset.countryName || items[0].textContent;
      }
      dom.suggestionsBox.style.display = "none";
      validateInput();
      runtime.round.submitGuess();
    } else if (event.key === "Escape") {
      if (dom.suggestionsBox.style.display !== "none") {
        event.preventDefault();
        clearSuggestions();
        actions.setSelectedIndex(-1);
        updateSelection(items);
      }
    }
  }

  function clearForm() {
    dom.input.value = "";
    clearSuggestions();
    actions.setSelectedIndex(-1);
    validateInput();
  }

  function bindInputHandlers() {
    dom.input.addEventListener("input", handleInputChange);
    dom.input.addEventListener("keydown", handleInputKeydown);
  }

  function applyContinentSelection() {
    const nextContinent = dom.continentFilter?.value || null;

    if (nextContinent === lastAppliedContinent) {
      dom.continentFilter?.blur();
      return;
    }

    lastAppliedContinent = nextContinent;
    actions.setSelectedContinent(nextContinent);
    runtime.worldMapInst.setRegionFilter(nextContinent);
    dom.continentFilter?.blur();

    requestAnimationFrame(() => {
      runtime.round.resetAll();
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
  function populateContinentFilter(countriesData) {
    if (!dom.continentFilter) {
      return;
    }

    const continents = [...new Set(
      countriesData
        .map((c) => c.properties.continent)
        .filter(Boolean)
    )].sort();
    const continentCounts = new Map(
      continents.map((continent) => [continent, getContinentCountryCount(countriesData, continent)])
    );

    const allContinentsOption = dom.continentFilter.querySelector('option[value=""]');
    if (allContinentsOption) {
      allContinentsOption.textContent = `All countries (${countriesData.length})`;
    }

    continents.forEach((continent) => {
      const option = document.createElement("option");
      option.value = continent;
      option.textContent = `${continent} (${continentCounts.get(continent)})`;
      dom.continentFilter.appendChild(option);
    });

    lastAppliedContinent = dom.continentFilter.value || null;

    dom.continentFilter.addEventListener("change", applyContinentSelection);
  }

  runtime.input = {
    bindInputHandlers,
    populateContinentFilter,
    isCountryInSelectedContinent,
    handleInputChange,
    handleInputKeydown,
    validateInput,
    syncGuessButtonState,
    clearSuggestions,
    clearForm,
    renderSuggestions,
    updateSelection
  };
})();
