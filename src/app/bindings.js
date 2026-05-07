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
  ['heroEyebrow',      'hero',    'eyebrow'],
  ['heroTitle',        'hero',    'title'],
  ['heroSubtitle',     'hero',    'subtitle'],
  ['ruleMisses',       'hero',    'misses'],
  ['ruleAutocomplete', 'hero',    'autocomplete'],
  ['ruleReveal',       'hero',    'reveal'],
  ['revealBtn',        'buttons', 'showAnswer'],
  ['nextRoundBtn',     'buttons', 'nextRound'],
  ['hintBtn',          'buttons', 'hint'],
  ['replayHaloBtn',    'buttons', 'replayHalo'],
  ['resetBtn',         'buttons', 'reset'],
];

/**
 * Maps DOM element keys → `round` method names for click handlers.
 * `replayHaloBtn` is omitted here because its handler (`replayHalo`) is an
 * imported function, not a method on the `round` object.
 *
 * @type {Array<[string, string]>}
 */
export const CLICK_BINDINGS = [
  ['revealBtn',    'revealAnswer'],
  ['hintBtn',      'showNextHint'],
  ['nextRoundBtn', 'advanceToNextRound'],
  ['resetBtn',     'startRound'],
];
