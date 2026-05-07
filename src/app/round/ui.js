/**
 * @fileoverview Round UI helpers – feedback text, score display, guess pills,
 * and input shake animation.
 *
 * Pure presentation functions that read from `runtime.dom` and
 * `runtime.config`; none of these functions mutate round or store state.
 *
 * Attaches itself to `runtime.roundUi`.
 */
import { worldleLiteLogger as log } from '../logger.js';

const getRuntime = () => window.worldleLiteRuntime ?? {};
const getDom     = () => getRuntime().dom    ?? {};
const getState   = () => getRuntime().state  ?? {};
const getConfig  = () => getRuntime().config ?? {};
const getTimers  = () => getRuntime().timers;
const confettiColors = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6", "#f97316"];

export function clearCelebration() {
    getTimers()?.cancel('celebration');

    if (getDom().celebration) {
      getDom().celebration.classList.remove("active");
      getDom().celebration.setAttribute("aria-hidden", "true");
    }

    if (getDom().celebrationText) {
      getDom().celebrationText.textContent = "";
    }

    if (getDom().confettiLayer) {
      getDom().confettiLayer.innerHTML = "";
    }
  }

  function createConfettiPiece(index) {
    const piece = document.createElement("span");
    const width = 8 + Math.floor(Math.random() * 7);
    const height = 10 + Math.floor(Math.random() * 12);
    const duration = 1700 + Math.floor(Math.random() * 900);
    const delay = Math.floor(Math.random() * 180);
    const drift = `${Math.round((Math.random() * 2 - 1) * 28)}vw`;
    const spin = `${Math.round((Math.random() * 2 - 1) * 540)}deg`;

    piece.className = "confetti-piece";
    piece.style.setProperty("--confetti-left", `${Math.round(Math.random() * 100)}%`);
    piece.style.setProperty("--confetti-width", `${width}px`);
    piece.style.setProperty("--confetti-height", `${height}px`);
    piece.style.setProperty("--confetti-duration", `${duration}ms`);
    piece.style.setProperty("--confetti-delay", `${delay}ms`);
    piece.style.setProperty("--confetti-drift", drift);
    piece.style.setProperty("--confetti-spin", spin);
    piece.style.setProperty("--confetti-color", confettiColors[index % confettiColors.length]);

    return piece;
  }

  function burstConfetti(count = 36) {
    if (!getDom().confettiLayer) {
      return;
    }

    getDom().confettiLayer.innerHTML = "";
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < count; index += 1) {
      fragment.appendChild(createConfettiPiece(index));
    }

    getDom().confettiLayer.appendChild(fragment);
  }

export function showCelebration(message) {
    log.info('[round UI] showCelebration', message);
    if (!getDom().celebration) {
      return;
    }

    clearCelebration();

    if (getDom().celebrationText) {
      getDom().celebrationText.textContent = message;
    }

    burstConfetti();
    getDom().celebration.classList.add("active");
    getDom().celebration.setAttribute("aria-hidden", "false");

    getTimers()?.schedule('celebration', () => {
      clearCelebration();
    }, 2400);
  }

  /**
   * Show `message` in the feedback element, applying `className` for styling.
   * @param {string} message
   * @param {string} className  e.g. `getConfig().CORRECT_MSG_CLASS`
   */
export function setFeedback(message, className) {
    log.debug('[round UI] setFeedback', { message, className });
    if (!getDom().feedback) {
      return;
    }

    getDom().feedback.hidden = false;
    getDom().feedback.textContent = message;
    getDom().feedback.className = className;
  }

  /** Hide and clear the feedback element. */
export function clearFeedback() {
    if (!getDom().feedback) {
      return;
    }

    getDom().feedback.textContent = "";
    getDom().feedback.className = "";
    getDom().feedback.hidden = true;
  }

  function formatHintText(hint) {
    if (!hint || typeof hint !== 'object') {
      return "";
    }

    if (hint.type === "flag") {
      return getConfig().COPY.hints.flag.replace("{flag}", hint.value || "");
    }

    if (hint.type === "first-letter") {
      return getConfig().COPY.hints.firstLetter.replace("{letter}", hint.value || "");
    }

    if (hint.type === "letter-count") {
      return getConfig().COPY.hints.letterCount.replace("{count}", String(hint.value ?? 0));
    }

    return "";
  }

export function setHints(hints = []) {
    log.debug('[round UI] setHints', hints);
    if (!getDom().hintText) {
      return;
    }

    const hintText = hints
      .map(formatHintText)
      .filter(Boolean)
      .join(getConfig().COPY.hints.separator);

    getDom().hintText.textContent = hintText;
  }

export function clearHints() {
    if (!getDom().hintText) {
      return;
    }

    getDom().hintText.textContent = "";
  }

export function buildWikipediaUrl(countryName) {
    const normalizedTitle = String(countryName ?? "").trim().replace(/\s+/g, "_");
    return normalizedTitle ? `https://en.wikipedia.org/wiki/${encodeURIComponent(normalizedTitle)}` : "";
  }

export function renderLinkedCountryName(container, countryName, className) {
    if (!container) {
      return;
    }

    container.textContent = "";

    const link = document.createElement("a");
    link.className = className;
    link.href = buildWikipediaUrl(countryName);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = countryName;
    container.appendChild(link);
  }

export function updateHintUsage() {
    if (!getDom().hintUsage) {
      return;
    }

    const roundState = getState().store.round;
    const maxHintsPerRound = getConfig().MAX_HINTS_PER_ROUND;
    getDom().hintUsage.textContent = `Hints this round: ${roundState.hintLevel}/${maxHintsPerRound}`;
  }

  /** Sync the score display with the current `store.numCorrect` and `store.numPlayed` values. */
export function updateStats() {
    log.debug('[round UI] updateStats', { numCorrect: getState().store?.numCorrect, numPlayed: getState().store?.numPlayed, numHintsUsed: getState().store?.numHintsUsed });
    if (getDom().scoreCorrect) {
      getDom().scoreCorrect.textContent = getState().store.numCorrect;
    }

    if (getDom().scorePlayed) {
      getDom().scorePlayed.textContent = getState().store.numPlayed;
    }

    if (getDom().hintsUsedInRound) {
      getDom().hintsUsedInRound.textContent = getState().store.numHintsUsed ?? 0;
    }

    if (getDom().totalHintsUsed) {
      getDom().totalHintsUsed.textContent = getState().store.numHintsUsed ?? 0;
    }
  }

  /** Briefly apply the shake animation to the input field and return focus to it. */
export function shakeInput() {
    getDom().input.classList.add("shake");
    setTimeout(() => {
      getDom().input.classList.remove("shake");
    }, 400);
    getDom().input.focus();
  }

  function createGuessPill() {
    const pill = document.createElement("span");
    pill.className = `${getConfig().GUESS_PILL_CLASS} empty visible`;
    pill.textContent = "";
    pill.setAttribute("aria-hidden", "true");
    return pill;
  }

  function getGuessVisuals(countryOrName) {
    if (typeof countryOrName === "string") {
      return {
        displayName: countryOrName,
        flagEmoji: null
      };
    }

    const properties = countryOrName?.properties ?? {};
    return {
      displayName: properties.displayName ?? properties.name ?? "",
      flagEmoji: properties.flagEmoji ?? null
    };
  }

  /**
   * Clear the guess list and render one empty pill placeholder per
   * allowed miss (`getConfig().MAX_MISSES_PER_ROUND`).
   */
export function renderGuessPlaceholders() {
    if (!getDom().guessList) {
      return;
    }

    getDom().guessList.innerHTML = "";

    for (let index = 0; index < getConfig().MAX_MISSES_PER_ROUND; index += 1) {
      getDom().guessList.appendChild(createGuessPill());
    }
  }

  /**
   * Fill the next empty pill in the guess history list.
   * @param {object|string} countryOrName
   * @param {"correct"|"guess"} resultType
   * @param {{ distanceKm: number, arrow: string } | null} [proximityInfo]
   */
export function fillNextGuessPill(countryOrName, resultType = "guess", proximityInfo = null) {
    if (!getDom().guessList) {
      return;
    }

    const nextPill = Array.from(getDom().guessList.children).find((pill) => pill.classList.contains("empty"));

    if (!nextPill) {
      return;
    }

    const { displayName, flagEmoji } = getGuessVisuals(countryOrName);

    nextPill.textContent = "";
    nextPill.classList.remove("empty");
    nextPill.classList.add("filled");
    nextPill.classList.toggle("correct", resultType === "correct");
    nextPill.classList.toggle("guess", resultType !== "correct");
    nextPill.dataset.result = resultType;
    nextPill.removeAttribute("aria-hidden");
    nextPill.setAttribute("role", "listitem");
    nextPill.setAttribute("aria-label", `${resultType === "correct" ? "Correct guess" : "Guess"}: ${displayName}`);

    if (resultType === "correct") {
      if (flagEmoji) {
        const flag = document.createElement("span");
        flag.className = "flag-badge";
        flag.textContent = flagEmoji;
        flag.setAttribute("aria-hidden", "true");
        nextPill.appendChild(flag);
      }

      // Render the linked country name into a child container so
      // `renderLinkedCountryName` doesn't clear the pill's contents
      // (which would remove the flag we just appended).
      const nameContainer = document.createElement("span");
      nameContainer.className = "guess-name-container";
      renderLinkedCountryName(nameContainer, displayName, "guess-name guess-name-link");
      nextPill.appendChild(nameContainer);
    } else {
      if (flagEmoji) {
        const flag = document.createElement("span");
        flag.className = "flag-badge";
        flag.textContent = flagEmoji;
        flag.setAttribute("aria-hidden", "true");
        nextPill.appendChild(flag);
      }

      const name = document.createElement("span");
      name.className = "guess-name";
      name.textContent = displayName;
      nextPill.appendChild(name);

      if (proximityInfo) {
        const badge = document.createElement("span");
        badge.className = "proximity-badge";
        if (proximityInfo.adjacent) {
          badge.textContent = `${proximityInfo.arrow} Adjacent`;
          badge.setAttribute("aria-label", "Adjacent to the target");
        } else {
          const formattedDist = proximityInfo.distanceKm >= 1000
            ? `${(proximityInfo.distanceKm / 1000).toFixed(1).replace(/\.0$/, "")}k km`
            : `${proximityInfo.distanceKm} km`;
          badge.textContent = `${proximityInfo.arrow} ${formattedDist}`;
          badge.setAttribute("aria-label", `${formattedDist} away`);
        }
        nextPill.appendChild(badge);
      }
    }
  }

// Backward-compat shim — remove once bootstrap.js uses import
getRuntime().roundUi = {
  buildWikipediaUrl,
  renderLinkedCountryName,
  setFeedback,
  clearFeedback,
  showCelebration,
  clearCelebration,
  setHints,
  clearHints,
  updateHintUsage,
  updateStats,
  shakeInput,
  renderGuessPlaceholders,
  fillNextGuessPill
};
