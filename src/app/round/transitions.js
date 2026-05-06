/**
 * @fileoverview Round transition progress bar and scroll helpers.
 *
 * Manages the animated CSS progress bar that plays between rounds, the timers
 * that schedule the next round, and the utility that scrolls the status area
 * into view on small-screen viewports.
 *
 * Attaches itself to `runtime.roundTransitions`.
 */
const getRuntime = () => window.worldleLiteRuntime ?? {};
const getDom     = () => getRuntime().dom     ?? {};
const getTimers  = () => getRuntime().timers;

  /**
   * Cancel any in-flight round transition timers and immediately reset the
   * progress bar to its hidden, zero-width state.
   */
export function clearRoundTransition() {
    getTimers()?.cancel('roundReveal');
    getTimers()?.cancel('roundTransition');
    getTimers()?.cancel('roundTransitionHide');

    if (getDom().roundTransition && getDom().roundTransitionFill) {
      getDom().roundTransition.classList.remove("visible");
      getDom().roundTransition.setAttribute("aria-hidden", "true");
      getDom().roundTransitionFill.style.transitionDuration = "0ms";
      getDom().roundTransitionFill.style.width = "0%";
    }

    if (getDom().roundTransitionLabel) {
      getDom().roundTransitionLabel.textContent = "";
    }
  }

  /**
   * Scroll the feedback element (or the transition bar when feedback is
   * hidden) into the centre of the viewport.  Useful on small screens where
   * the status area may be below the fold after a guess.
   */
export function scrollStatusIntoView() {
    const target = getDom().feedback && !getDom().feedback.hidden ? getDom().feedback : getDom().roundTransition;

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
export function beginRoundTransition(duration, label, nextRoundFn) {
    clearRoundTransition();

    if (!getDom().roundTransition || !getDom().roundTransitionFill || !getDom().roundTransitionLabel) {
      getTimers()?.schedule('roundTransition', nextRoundFn, duration);
      return;
    }

    getDom().roundTransitionLabel.textContent = `${label}...`;
    getDom().roundTransition.classList.add("visible");
    getDom().roundTransition.setAttribute("aria-hidden", "false");
    getDom().roundTransitionFill.style.transitionDuration = `${duration}ms`;
    getDom().roundTransitionFill.style.width = "0%";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        getDom().roundTransitionFill.style.width = "100%";
      });
    });

    getTimers()?.schedule('roundTransition', nextRoundFn, duration);
    getTimers()?.schedule('roundTransitionHide', () => {
      clearRoundTransition();
    }, duration + 120);
  }
