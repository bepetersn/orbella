/**
 * @fileoverview Country-name normalisation utilities.
 *
 * Exposes `normalizeGuess` and `toLooseGuessKey` on `window._gameStore`.
 */
(() => {
  const _store = window._gameStore;

  const combiningMarkPattern = /\p{M}/gu;
  const apostropheLikePattern = /[’'`´]/gu;
  const ampersandPattern = /&/gu;
  const looseKeyNonAlphaNumericPattern = /[^\p{L}\p{N}]/gu;

  function normalizeGuess(guessName) {
    return String(guessName ?? "")
      .trim()
      .normalize("NFKD")
      .replace(combiningMarkPattern, "")
      .replace(ampersandPattern, " and ")
      .replace(apostropheLikePattern, " ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .toLowerCase()
      .trim();
  }

  function toLooseGuessKey(guessName) {
    return normalizeGuess(guessName).replace(looseKeyNonAlphaNumericPattern, "");
  }

  _store.normalizeGuess = normalizeGuess;
  _store.toLooseGuessKey = toLooseGuessKey;
})();
