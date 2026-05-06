/**
 * @fileoverview Assembles the public `round` API from the three round
 * sub-modules (control, ui, transitions) and the input module.
 *
 * Other code can call `round.startRound()`, `round.submitGuess()`, etc.
 * without knowing which sub-module owns each method.
 */
import * as control     from './control.js';
import * as ui          from './ui.js';
import * as transitions from './transitions.js';
import { clearForm }    from '../input.js';

export const round = {
  submitGuess:         (...args) => control.submitGuess?.(...args),
  startRound:          (...args) => control.startRound?.(...args),
  revealAnswer:        (...args) => control.revealAnswer?.(...args),
  showNextHint:        (...args) => control.showNextHint?.(...args),
  advanceToNextRound:  (...args) => control.advanceToNextRound?.(...args),
  replayHalo:          (...args) => control.replayHalo?.(...args),
  renderRoundState:    (...args) => control.renderRoundState?.(...args),
  resetAll:            (...args) => control.resetAll?.(...args),
  setFeedback:         (...args) => ui.setFeedback?.(...args),
  clearFeedback:       (...args) => ui.clearFeedback?.(...args),
  showCelebration:     (...args) => ui.showCelebration?.(...args),
  clearCelebration:    (...args) => ui.clearCelebration?.(...args),
  updateStats:         (...args) => ui.updateStats?.(...args),
  shakeInput:          (...args) => ui.shakeInput?.(...args),
  clearRoundTransition:(...args) => transitions.clearRoundTransition?.(...args),
  beginRoundTransition:(...args) => transitions.beginRoundTransition?.(...args),
  clearForm:           (...args) => clearForm?.(...args),
};
