/**
 * @fileoverview Round UI helpers – feedback text, score display, guess pills,
 * and input shake animation.
 *
 * Pure presentation functions that read from `runtime.dom` and
 * `runtime.config`; none of these functions mutate round or store state.
 *
 * Attaches itself to `runtime.roundUi`.
 */
(() => {
  const runtime = window.worldleLiteRuntime;
  const { dom, state, config } = runtime;
  const confettiColors = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6", "#f97316"];

  function clearCelebration() {
    if (runtime.celebrationTimer) {
      clearTimeout(runtime.celebrationTimer);
      runtime.celebrationTimer = null;
    }

    if (dom.celebration) {
      dom.celebration.classList.remove("active");
      dom.celebration.setAttribute("aria-hidden", "true");
    }

    if (dom.celebrationText) {
      dom.celebrationText.textContent = "";
    }

    if (dom.confettiLayer) {
      dom.confettiLayer.innerHTML = "";
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
    if (!dom.confettiLayer) {
      return;
    }

    dom.confettiLayer.innerHTML = "";
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < count; index += 1) {
      fragment.appendChild(createConfettiPiece(index));
    }

    dom.confettiLayer.appendChild(fragment);
  }

  function showCelebration(message) {
    try { window.worldleLiteLogger?.info('[round UI] showCelebration', message); } catch (e) {}
    if (!dom.celebration) {
      return;
    }

    clearCelebration();

    if (dom.celebrationText) {
      dom.celebrationText.textContent = message;
    }

    burstConfetti();
    dom.celebration.classList.add("active");
    dom.celebration.setAttribute("aria-hidden", "false");

    runtime.celebrationTimer = setTimeout(() => {
      clearCelebration();
    }, 2400);
  }

  /**
   * Show `message` in the feedback element, applying `className` for styling.
   * @param {string} message
   * @param {string} className  e.g. `config.CORRECT_MSG_CLASS`
   */
  function setFeedback(message, className) {
    try { window.worldleLiteLogger?.debug('[round UI] setFeedback', { message, className }); } catch (e) {}
    if (!dom.feedback) {
      return;
    }

    dom.feedback.hidden = false;
    dom.feedback.textContent = message;
    dom.feedback.className = className;
  }

  /** Hide and clear the feedback element. */
  function clearFeedback() {
    if (!dom.feedback) {
      return;
    }

    dom.feedback.textContent = "";
    dom.feedback.className = "";
    dom.feedback.hidden = true;
  }

  function formatHintText(hint) {
    if (!hint || typeof hint !== 'object') {
      return "";
    }

    if (hint.type === "flag") {
      return config.COPY.hints.flag.replace("{flag}", hint.value || "");
    }

    if (hint.type === "first-letter") {
      return config.COPY.hints.firstLetter.replace("{letter}", hint.value || "");
    }

    if (hint.type === "letter-count") {
      return config.COPY.hints.letterCount.replace("{count}", String(hint.value ?? 0));
    }

    return "";
  }

  function setHints(hints = []) {
    try { window.worldleLiteLogger?.debug('[round UI] setHints', hints); } catch (e) {}
    if (!dom.hintText) {
      return;
    }

    const hintText = hints
      .map(formatHintText)
      .filter(Boolean)
      .join(config.COPY.hints.separator);

    dom.hintText.textContent = hintText;
  }

  function clearHints() {
    if (!dom.hintText) {
      return;
    }

    dom.hintText.textContent = "";
  }

  function buildWikipediaUrl(countryName) {
    const normalizedTitle = String(countryName ?? "").trim().replace(/\s+/g, "_");
    return normalizedTitle ? `https://en.wikipedia.org/wiki/${encodeURIComponent(normalizedTitle)}` : "";
  }

  function renderLinkedCountryName(container, countryName, className) {
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

  function updateHintUsage() {
    if (!dom.hintUsage) {
      return;
    }

    const roundState = state.store.round;
    const maxHintsPerRound = config.MAX_HINTS_PER_ROUND;
    dom.hintUsage.textContent = `Hints this round: ${roundState.hintLevel}/${maxHintsPerRound}`;
  }

  /** Sync the score display with the current `store.numCorrect` and `store.numPlayed` values. */
  function updateStats() {
    try { window.worldleLiteLogger?.debug('[round UI] updateStats', { numCorrect: state.store.numCorrect, numPlayed: state.store.numPlayed, numHintsUsed: state.store.numHintsUsed }); } catch (e) {}
    if (dom.scoreCorrect) {
      dom.scoreCorrect.textContent = state.store.numCorrect;
    }

    if (dom.scorePlayed) {
      dom.scorePlayed.textContent = state.store.numPlayed;
    }

    if (dom.hintsUsedInRound) {
      dom.hintsUsedInRound.textContent = state.store.numHintsUsed ?? 0;
    }

    if (dom.totalHintsUsed) {
      dom.totalHintsUsed.textContent = state.store.numHintsUsed ?? 0;
    }
  }

  /** Briefly apply the shake animation to the input field and return focus to it. */
  function shakeInput() {
    dom.input.classList.add("shake");
    setTimeout(() => {
      dom.input.classList.remove("shake");
    }, 400);
    dom.input.focus();
  }

  function createGuessPill() {
    const pill = document.createElement("span");
    pill.className = `${config.GUESS_PILL_CLASS} empty visible`;
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
   * allowed miss (`config.MAX_MISSES_PER_ROUND`).
   */
  function renderGuessPlaceholders() {
    if (!dom.guessList) {
      return;
    }

    dom.guessList.innerHTML = "";

    for (let index = 0; index < config.MAX_MISSES_PER_ROUND; index += 1) {
      dom.guessList.appendChild(createGuessPill());
    }
  }

  /**
   * Fill the next empty pill in the guess history list.
   * @param {object|string} countryOrName
   * @param {"correct"|"guess"} resultType
   * @param {{ distanceKm: number, arrow: string } | null} [proximityInfo]
   */
  function fillNextGuessPill(countryOrName, resultType = "guess", proximityInfo = null) {
    if (!dom.guessList) {
      return;
    }

    const nextPill = Array.from(dom.guessList.children).find((pill) => pill.classList.contains("empty"));

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

  runtime.roundUi = {
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
})();
