/**
 * @fileoverview Builds the country-guess lookup tables from loaded GeoJSON data.
 *
 * Pure functions only – no direct access to live state.
 * Exposes `createCountryGuessLookup` on `window._gameStore`.
 */
(() => {
  const _store = window._gameStore;
  const { normalizeGuess, toLooseGuessKey } = _store;

  function addLookupEntry(lookup, looseLookup, entries, seenEntryKeys, key, country, source = "canonical") {
    const normalizedKey = normalizeGuess(key);
    if (!normalizedKey || !country) {
      return;
    }

    if (!lookup.has(normalizedKey)) {
      lookup.set(normalizedKey, country);
    }

    const looseKey = toLooseGuessKey(normalizedKey);
    if (looseKey && !looseLookup.has(looseKey)) {
      looseLookup.set(looseKey, country);
    }

    const entryKey = `${normalizedKey}::${country.properties?.name ?? ""}`;
    if (!seenEntryKeys.has(entryKey)) {
      seenEntryKeys.add(entryKey);
      entries.push({ key: normalizedKey, country, source });
    }
  }

  function createCountryGuessLookup(countriesData, countryByName) {
    const lookup = new Map();
    const looseLookup = new Map();
    const entries = [];
    const seenEntryKeys = new Set();

    countriesData.forEach((country) => {
      const displayName = country?.properties?.displayName ?? country?.properties?.name;
      if (!displayName) {
        return;
      }

      addLookupEntry(lookup, looseLookup, entries, seenEntryKeys, displayName, country, "canonical");

      if (displayName.startsWith("The ")) {
        addLookupEntry(lookup, looseLookup, entries, seenEntryKeys, displayName.slice(4), country, "canonical");
      }

      const aliases = country?.properties?.aliases ?? country?.properties?.synonyms ?? country?.properties?.NAME_ALIASES;
      if (Array.isArray(aliases)) {
        aliases.forEach((aliasName) => addLookupEntry(lookup, looseLookup, entries, seenEntryKeys, aliasName, country, "alias"));
      }
    });

    if (countryByName instanceof Map) {
      for (const [key, country] of countryByName) {
        addLookupEntry(lookup, looseLookup, entries, seenEntryKeys, key, country);
      }
    }

    return {
      countryByGuess: lookup,
      countryByLooseGuess: looseLookup,
      countryLookupEntries: entries
    };
  }

  _store.createCountryGuessLookup = createCountryGuessLookup;
})();
