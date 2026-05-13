/**
 * @fileoverview Country-guess resolution and autocomplete query helpers.
 *
 * Reads from live state via `getCurrentState()`.
 */
import { normalizeGuess, toLooseGuessKey } from './normalize.js';
import { getCurrentState } from './reducer.js';

const fuzzyDistanceLimit = 2;
const minFuzzyQueryLength = 3;

// Memoize getCountrySuggestionGroups per state reference. On each keystroke
// both resolveCountryGuess and getSuggestedCountryNames call this function
// with the same state object. Without caching this iterates countryLookupEntries
// twice per keystroke — unnecessary work on every input event.
let _cachedGroupsState = null;
let _cachedGroups = null;

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

function getCountrySuggestionGroups(state) {
  if (state === _cachedGroupsState && _cachedGroups !== null) {
    return _cachedGroups;
  }
  const groups = new Map();

  for (const entry of state.countryLookupEntries) {
    const country = entry.country;
    const countryName = country?.properties?.displayName ?? country?.properties?.name;

    if (!countryName) {
      continue;
    }

    const groupKey = countryName;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        country,
        countryName,
        displayName: countryName,
        entries: [],
      });
    }

    groups.get(groupKey).entries.push(entry);
  }

  _cachedGroupsState = state;
  _cachedGroups = [...groups.values()];
  return _cachedGroups;
}

function getTokenSet(key) {
  return new Set(
    String(key ?? '')
      .split(' ')
      .filter(Boolean)
  );
}

function getAcronymKey(key) {
  return String(key ?? '')
    .split(' ')
    .filter(Boolean)
    .map((token) => token[0])
    .join('');
}

function getEditDistance(left, right) {
  if (left === right) {
    return 0;
  }

  if (!left || !right) {
    return Math.max(left.length, right.length);
  }

  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  let previousRow = Array.from({ length: shorter.length + 1 }, (_, index) => index);

  for (let longerIndex = 1; longerIndex <= longer.length; longerIndex += 1) {
    const currentRow = [longerIndex];
    const longerChar = longer[longerIndex - 1];

    for (let shorterIndex = 1; shorterIndex <= shorter.length; shorterIndex += 1) {
      const substitutionCost = shorter[shorterIndex - 1] === longerChar ? 0 : 1;
      currentRow.push(
        Math.min(
          previousRow[shorterIndex] + 1,
          currentRow[shorterIndex - 1] + 1,
          previousRow[shorterIndex - 1] + substitutionCost
        )
      );
    }

    previousRow = currentRow;
  }

  return previousRow[shorter.length];
}

function scoreFuzzyCountryMatch(queryKey, candidateKey) {
  if (!queryKey || !candidateKey) {
    return null;
  }

  if (queryKey.length < minFuzzyQueryLength) {
    return null;
  }

  const allowSubstringMatching = queryKey.length >= 3;

  if (queryKey.length >= 3 && getAcronymKey(candidateKey) === queryKey) {
    return { score: 1, distance: 0 };
  }

  if (allowSubstringMatching && candidateKey.includes(queryKey)) {
    return { score: 2, distance: 0 };
  }

  if (allowSubstringMatching && queryKey.includes(candidateKey)) {
    return { score: 3, distance: 0 };
  }

  const queryTokens = getTokenSet(queryKey);
  const candidateTokens = getTokenSet(candidateKey);
  if (
    allowSubstringMatching &&
    queryTokens.size > 0 &&
    [...queryTokens].every((token) => candidateTokens.has(token))
  ) {
    return { score: 4, distance: 0 };
  }

  const compactDistance = getEditDistance(toLooseGuessKey(queryKey), toLooseGuessKey(candidateKey));
  if (compactDistance <= fuzzyDistanceLimit) {
    return { score: 5, distance: compactDistance };
  }

  return null;
}

function getBestFuzzyCountryMatch(state, queryKey, selectedContinent = null) {
  const matches = [];

  for (const group of getCountrySuggestionGroups(state)) {
    if (!isCountryInSelectedContinent(group.country, selectedContinent)) {
      continue;
    }

    let bestMatch = null;

    for (const { key } of group.entries) {
      const matchScore = scoreFuzzyCountryMatch(queryKey, key);
      if (!matchScore) {
        continue;
      }

      const candidateMatch = { key, ...matchScore };
      if (!bestMatch) {
        bestMatch = candidateMatch;
        continue;
      }

      if (
        candidateMatch.score < bestMatch.score ||
        (candidateMatch.score === bestMatch.score && candidateMatch.distance < bestMatch.distance)
      ) {
        bestMatch = candidateMatch;
      }
    }

    if (bestMatch) {
      matches.push({ country: group.country, key: bestMatch.key, ...bestMatch });
    }
  }

  if (!matches.length) {
    return null;
  }

  matches.sort((left, right) => {
    if (left.score !== right.score) {
      return left.score - right.score;
    }

    if (left.distance !== right.distance) {
      return left.distance - right.distance;
    }

    return left.key.localeCompare(right.key);
  });

  const bestMatch = matches[0];
  const tiedMatches = matches.filter(
    (match) => match.score === bestMatch.score && match.distance === bestMatch.distance
  );

  return tiedMatches.length === 1 ? bestMatch.country : null;
}

export function resolveCountryGuess(guessName) {
  const normalizedGuess = normalizeGuess(guessName);
  if (!normalizedGuess) {
    return null;
  }

  const state = getCurrentState();
  const selectedContinent = state.selectedContinent;
  const strictMatch = state.countryByGuess.get(normalizedGuess);
  const looseGuess = toLooseGuessKey(normalizedGuess);
  const looseMatch = looseGuess ? state.countryByLooseGuess.get(looseGuess) : null;
  const eligibleStrictMatch = isCountryInSelectedContinent(strictMatch, selectedContinent)
    ? strictMatch
    : null;
  const eligibleLooseMatch = isCountryInSelectedContinent(looseMatch, selectedContinent)
    ? looseMatch
    : null;
  const fuzzyMatch =
    eligibleStrictMatch || eligibleLooseMatch
      ? null
      : getBestFuzzyCountryMatch(state, normalizedGuess, selectedContinent);
  const match = eligibleStrictMatch || eligibleLooseMatch || fuzzyMatch || null;

  if (!match) {
    return null;
  }

  return match;
}

export function getSuggestedCountryNames(query, limit = 8) {
  const normalizedQuery = normalizeGuess(query);
  if (!normalizedQuery) {
    return [];
  }

  const state = getCurrentState();
  const groups = getCountrySuggestionGroups(state).filter((group) =>
    isCountryInSelectedContinent(group.country, state.selectedContinent)
  );
  const prefixMatches = [];

  for (const group of groups) {
    if (group.entries.some(({ key }) => key.startsWith(normalizedQuery))) {
      prefixMatches.push(group.displayName ?? group.countryName);
    }
  }

  if (prefixMatches.length > 0) {
    return [...new Set(prefixMatches)]
      .sort((left, right) => left.localeCompare(right))
      .slice(0, limit);
  }

  if (normalizedQuery.length < minFuzzyQueryLength) {
    return [];
  }

  const fuzzyMatches = [];

  for (const group of groups) {
    let bestMatch = null;

    for (const { key } of group.entries) {
      const matchScore = scoreFuzzyCountryMatch(normalizedQuery, key);
      if (!matchScore) {
        continue;
      }

      const candidateMatch = { key, ...matchScore };
      if (
        !bestMatch ||
        candidateMatch.score < bestMatch.score ||
        (candidateMatch.score === bestMatch.score && candidateMatch.distance < bestMatch.distance)
      ) {
        bestMatch = candidateMatch;
      }
    }

    if (!bestMatch) {
      continue;
    }

    fuzzyMatches.push({
      countryName: group.displayName ?? group.countryName,
      key: bestMatch.key,
      ...bestMatch,
    });
  }

  return fuzzyMatches
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }

      if (left.distance !== right.distance) {
        return left.distance - right.distance;
      }

      return left.countryName.localeCompare(right.countryName);
    })
    .map(({ countryName }) => countryName)
    .slice(0, limit);
}
