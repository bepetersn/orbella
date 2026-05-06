import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../../src/app/round/control.js', () => ({
  submitGuess:        vi.fn(),
  startRound:         vi.fn(),
  revealAnswer:       vi.fn(),
  showNextHint:       vi.fn(),
  advanceToNextRound: vi.fn(),
  replayHalo:         vi.fn(),
  renderRoundState:   vi.fn(),
  resetAll:           vi.fn(),
}));

vi.mock('../../../../src/app/round/ui.js', () => ({
  setFeedback:      vi.fn(),
  clearFeedback:    vi.fn(),
  showCelebration:  vi.fn(),
  clearCelebration: vi.fn(),
  updateStats:      vi.fn(),
  shakeInput:       vi.fn(),
}));

vi.mock('../../../../src/app/round/transitions.js', () => ({
  clearRoundTransition:  vi.fn(),
  beginRoundTransition:  vi.fn(),
  scrollStatusIntoView:  vi.fn(),
}));

vi.mock('../../../../src/app/input.js', () => ({
  clearForm:             vi.fn(),
  bindInputHandlers:     vi.fn(),
  populateContinentFilter: vi.fn(),
  isCountryInSelectedContinent: vi.fn(),
  handleInputChange:     vi.fn(),
  handleInputKeydown:    vi.fn(),
  validateInput:         vi.fn(),
  syncGuessButtonState:  vi.fn(),
  clearSuggestions:      vi.fn(),
  renderSuggestions:     vi.fn(),
  updateSelection:       vi.fn(),
}));

describe('round/index', () => {
  let round;
  let control, ui, transitions, input;

  beforeEach(async () => {
    vi.resetModules();
    control     = await import('../../../../src/app/round/control.js');
    ui          = await import('../../../../src/app/round/ui.js');
    transitions = await import('../../../../src/app/round/transitions.js');
    input       = await import('../../../../src/app/input.js');
    ({ round }  = await import('../../../../src/app/round/index.js'));
  });

  it('exports round object', () => {
    expect(round).toBeDefined();
    expect(typeof round).toBe('object');
  });

  describe('roundControl methods', () => {
    it.each(['submitGuess', 'startRound', 'revealAnswer', 'showNextHint', 'advanceToNextRound', 'replayHalo', 'renderRoundState', 'resetAll'])(
      'exposes %s and delegates to control module',
      (method) => {
        expect(typeof round[method]).toBe('function');
        round[method]('arg');
        expect(control[method]).toHaveBeenCalledWith('arg');
      }
    );
  });

  describe('roundUi methods', () => {
    it.each(['setFeedback', 'clearFeedback', 'showCelebration', 'clearCelebration', 'updateStats', 'shakeInput'])(
      'exposes %s and delegates to ui module',
      (method) => {
        expect(typeof round[method]).toBe('function');
        round[method]('arg');
        expect(ui[method]).toHaveBeenCalledWith('arg');
      }
    );
  });

  describe('roundTransitions methods', () => {
    it.each(['clearRoundTransition', 'beginRoundTransition'])(
      'exposes %s and delegates to transitions module',
      (method) => {
        expect(typeof round[method]).toBe('function');
        round[method]('arg');
        expect(transitions[method]).toHaveBeenCalledWith('arg');
      }
    );
  });

  describe('clearForm', () => {
    it('delegates to input.clearForm', () => {
      round.clearForm('arg');
      expect(input.clearForm).toHaveBeenCalledWith('arg');
    });
  });
});

