/**
 * @fileoverview Country-name normalisation utilities.
 *
 * Exposes `normalizeGuess` and `toLooseGuessKey` on `window._gameStore`.
 */
const combiningMarkPattern = /\p{M}/gu;
const apostropheLikePattern = /[''`´]/gu;
const ampersandPattern = /&/gu;
const looseKeyNonAlphaNumericPattern = /[^\p{L}\p{N}]/gu;

export function normalizeGuess(guessName) {
  return String(guessName ?? '')
    .trim()
    .normalize('NFKD')
    .replace(combiningMarkPattern, '')
    .replace(ampersandPattern, ' and ')
    .replace(apostropheLikePattern, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

export function toLooseGuessKey(guessName) {
  const normalized = normalizeGuess(guessName);
  return normalized
    .split(/\s+/)
    .filter((word) => word.length > 1)
    .join('');
}

