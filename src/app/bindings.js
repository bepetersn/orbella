/**
 * @fileoverview Static binding tables used during bootstrap.
 *
 * Each entry is a tuple of DOM-element key (from queryDomElements) plus the
 * location of the value inside the relevant object, expressed as plain
 * strings so the data stays serialisable and easy to test.
 */

/**
 * Maps DOM element keys → [COPY section, COPY property].
 * Used by `initializeCopy` to set `textContent` on UI elements.
 *
 * @type {Array<[string, string, string]>}
 */
export const COPY_BINDINGS = [
  ['heroEyebrow', 'hero', 'eyebrow'],
  ['heroTitle', 'hero', 'title'],
  ['heroSubtitle', 'hero', 'subtitle'],
  ['ruleMisses', 'hero', 'misses'],
  ['ruleAutocomplete', 'hero', 'autocomplete'],
  ['ruleReveal', 'hero', 'reveal'],
  ['revealBtn', 'buttons', 'showAnswer'],
  ['nextRoundBtn', 'buttons', 'nextRound'],
  ['hintBtn', 'buttons', 'hint'],
  ['replayHaloBtn', 'buttons', 'replayHalo'],
  ['resetBtn', 'buttons', 'reset'],
];

/**
 * Maps DOM element keys → `round` method names for click handlers.
 * `replayHaloBtn` is omitted here because its handler (`replayHalo`) is an
 * imported function, not a method on the `round` object.
 *
 * @type {Array<[string, string]>}
 */
export const CLICK_BINDINGS = [
  ['revealBtn', 'revealAnswer'],
  ['hintBtn', 'showNextHint'],
  ['nextRoundBtn', 'advanceToNextRound'],
  ['resetBtn', 'startRound'],
];

// Imported here to avoid circular deps — bindings.js is the natural home for
// functions that apply these binding tables to live DOM/runtime objects.
import { round } from './round/index.js';
import { replayHalo } from './round/control.js';
import { syncDebugToggleUi, bindDebugToggle } from './debug.js';
import { worldleLiteLogger as log } from './logger.js';

/**
 * Applies COPY text to DOM elements listed in COPY_BINDINGS and syncs the
 * debug-toggle UI.
 */
export function initializeCopy(dom, COPY, buildId) {
  document.title = COPY.pageTitle || document.title;
  if (dom.buildMarker) dom.buildMarker.textContent = `Build: ${buildId || ''}`;
  for (const [domKey, section, prop] of COPY_BINDINGS) {
    const el = dom[domKey];
    const text = COPY[section]?.[prop];
    if (el && text) el.textContent = text;
  }
  syncDebugToggleUi();
}

/**
 * Attaches all click and input event listeners declared in CLICK_BINDINGS.
 */
export function bindEventListeners(dom, runtime) {
  log.debug('[bootstrap] bindEventListeners - btn refs:', {
    hint: !!dom.hintBtn,
    reveal: !!dom.revealBtn,
  });
  for (const [domKey, method] of CLICK_BINDINGS) {
    dom[domKey]?.addEventListener('click', () => round[method]?.());
  }
  dom.replayHaloBtn?.addEventListener('click', () => replayHalo());
  bindDebugToggle();
  runtime.input?.bindInputHandlers?.();
}
