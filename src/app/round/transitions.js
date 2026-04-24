/**
 * @fileoverview Round transition progress bar and scroll helpers.
 *
 * Manages the animated CSS progress bar that plays between rounds, the timers
 * that schedule the next round, and the utility that scrolls the status area
 * into view on small-screen viewports.
 *
 * Attaches itself to `runtime.roundTransitions`.
 */
(() => {
  const runtime = window.worldleLiteRuntime;
  const { dom } = runtime;

  /**
   * Cancel any in-flight round transition timers and immediately reset the
   * progress bar to its hidden, zero-width state.
   */
  function clearRoundTransition() {
    if (runtime.roundRevealTimer) {
      clearTimeout(runtime.roundRevealTimer);
      runtime.roundRevealTimer = null;
    }

    if (runtime.roundTransitionTimer) {
      clearTimeout(runtime.roundTransitionTimer);
      runtime.roundTransitionTimer = null;
    }

    if (runtime.roundTransitionHideTimer) {
      clearTimeout(runtime.roundTransitionHideTimer);
      runtime.roundTransitionHideTimer = null;
    }

    if (dom.roundTransition && dom.roundTransitionFill) {
      dom.roundTransition.classList.remove("visible");
      dom.roundTransition.setAttribute("aria-hidden", "true");
      dom.roundTransitionFill.style.transitionDuration = "0ms";
      dom.roundTransitionFill.style.width = "0%";
    }

    if (dom.roundTransitionLabel) {
      dom.roundTransitionLabel.textContent = "";
    }
  }

  /**
   * Scroll the feedback element (or the transition bar when feedback is
   * hidden) into the centre of the viewport.  Useful on small screens where
   * the status area may be below the fold after a guess.
   */
  function scrollStatusIntoView() {
    const target = dom.feedback && !dom.feedback.hidden ? dom.feedback : dom.roundTransition;

    if (!target || typeof target.scrollIntoView !== "function") {
      return;
    }

    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    });
  }

  /**
   * Start the progress-bar animation and schedule `nextRoundFn` to run after
   * `duration` ms.  The bar fills from 0% to 100% over `duration` ms, then
   * hides itself 120 ms after the callback fires.
   *
   * @param {number}   duration      Animation and timer duration in milliseconds.
   * @param {string}   label         Text shown above the progress bar.
   * @param {Function} nextRoundFn   Callback invoked when the timer fires.
   */
  function beginRoundTransition(duration, label, nextRoundFn) {
    clearRoundTransition();

    if (!dom.roundTransition || !dom.roundTransitionFill || !dom.roundTransitionLabel) {
      runtime.roundTransitionTimer = setTimeout(nextRoundFn, duration);
      return;
    }

    dom.roundTransitionLabel.textContent = `${label}...`;
    dom.roundTransition.classList.add("visible");
    dom.roundTransition.setAttribute("aria-hidden", "false");
    dom.roundTransitionFill.style.transitionDuration = `${duration}ms`;
    dom.roundTransitionFill.style.width = "0%";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dom.roundTransitionFill.style.width = "100%";
      });
    });

    runtime.roundTransitionTimer = setTimeout(nextRoundFn, duration);
    runtime.roundTransitionHideTimer = setTimeout(() => {
      clearRoundTransition();
    }, duration + 120);
  }

  runtime.roundTransitions = {
    clearRoundTransition,
    scrollStatusIntoView,
    beginRoundTransition
  };
})();
