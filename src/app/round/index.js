/**
 * @fileoverview Assembles the public `runtime.round` API from the three round
 * sub-modules (control, ui, transitions) and the input module.
 *
 * After this module runs, other code can call `runtime.round.startRound()`,
 * `runtime.round.submitGuess()`, etc. without knowing which sub-module owns
 * each method.
 */
(() => {
  const runtime = window.worldleLiteRuntime;
  const control = runtime.roundControl;
  const ui = runtime.roundUi;
  const transitions = runtime.roundTransitions;

  runtime.round = {
    ...control,
    setFeedback: ui.setFeedback,
    clearFeedback: ui.clearFeedback,
    showCelebration: ui.showCelebration,
    clearCelebration: ui.clearCelebration,
    updateStats: ui.updateStats,
    shakeInput: ui.shakeInput,
    clearRoundTransition: transitions.clearRoundTransition,
    beginRoundTransition: transitions.beginRoundTransition,
    clearForm(...args) {
      return runtime.input?.clearForm?.(...args);
    }
  };
})();
