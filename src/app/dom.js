/**
 * @fileoverview DOM element references for the Worldle Lite application.
 *
 * Queries all named elements from the document and returns them as a plain
 * object. Bootstrap passes this object into the runtime so every subsystem
 * can access DOM refs through `getRuntime().dom` without touching the DOM
 * directly.
 *
 * In tests, callers supply their own `dom` override via `runtimeOverride.dom`
 * and this function is never called.
 */

export function queryDomElements() {
  return {
    input: document.getElementById('guessInput'),
    inputWrapper: document.getElementById('input-wrapper'),
    suggestionsBox: document.getElementById('suggestions'),
    continentFilter: document.getElementById('continent-filter'),
    revealBtn: document.getElementById('btn-reveal'),
    hintBtn: document.getElementById('btn-hint'),
    nextRoundBtn: document.getElementById('btn-next-round'),
    replayHaloBtn: document.getElementById('btn-replay-halo'),
    resetBtn: document.getElementById('btn-reset'),
    feedback: document.getElementById('feedback'),
    guessList: document.getElementById('guess-list'),
    hintPanel: document.getElementById('hint-panel'),
    hintText: document.getElementById('hint-text'),
    revealPanel: document.getElementById('reveal-panel'),
    revealTarget: document.getElementById('revealTarget'),
    celebration: document.getElementById('celebration'),
    celebrationText: document.getElementById('celebration-text'),
    confettiLayer: document.getElementById('confetti-layer'),
    roundTransition: document.getElementById('round-transition'),
    roundTransitionFill: document.getElementById('round-transition-fill'),
    roundTransitionLabel: document.getElementById('round-transition-label'),
    themeToggle: document.getElementById('theme-toggle'),
    debugToggle: document.getElementById('debug-toggle'),
    autoAdvanceToggle: document.getElementById('auto-advance-toggle'),
    buildMarker: document.getElementById('build-marker'),
    heroEyebrow: document.getElementById('hero-eyebrow'),
    heroTitle: document.getElementById('app-title'),
    heroSubtitle: document.getElementById('app-subtitle'),
    ruleMisses: document.getElementById('rule-misses'),
    ruleAutocomplete: document.getElementById('rule-autocomplete'),
    ruleReveal: document.getElementById('rule-reveal'),
    scoreCorrect: document.getElementById('numCorrect'),
    scorePlayed: document.getElementById('numPlayed'),
    regionProgress: document.getElementById('region-progress'),
    hintsUsedInRound: document.getElementById('numHintsUsed'),
    hintUsage: document.getElementById('hints-round'),
    leftSidebar: document.getElementById('left-sidebar'),
  };
}
