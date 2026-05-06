import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildRuntime } from '../../../fixtures/runtime-builder.js';
import { createTimerManager } from '../../../../src/app/timerManager.js';

const ROUND_OUTCOME = { active: 'active', won: 'won', missed: 'missed', revealed: 'revealed' };

function makeCountry(name = 'France', isoCode = 'FR') {
  return {
    properties: {
      name,
      displayName: name,
      isoCode,
      neighborIsoCodes: [],
      geometryCenter: [2.35, 48.85],
    },
  };
}

describe('round/control', () => {
  let mod;
  let runtime;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();

    runtime = buildRuntime();

    // Real timer manager so schedule/cancel work
    runtime.timers = createTimerManager();

    // audio stubs
    runtime.audioFeedback = {
      primeAudio: vi.fn(),
      correct: vi.fn(),
      wrong: vi.fn(),
      loss: vi.fn(),
    };

    // worldMapInst stubs
    runtime.worldMapInst = {
      focusOnCountry: vi.fn(),
      highlightCountry: vi.fn(),
      resetHighlight: vi.fn(),
      showLocationHalo: vi.fn(),
      replayHalo: vi.fn(),
      markSolved: vi.fn(),
      markWrong: vi.fn(),
      markTarget: vi.fn(),
      zoomToCountry: vi.fn(),
      resetRoundState: vi.fn(),
    };

    // roundUi stubs
    runtime.roundUi = {
      setFeedback: vi.fn(),
      clearFeedback: vi.fn(),
      showCelebration: vi.fn(),
      clearCelebration: vi.fn(),
      updateStats: vi.fn(),
      updateHintUsage: vi.fn(),
      shakeInput: vi.fn(),
      fillNextGuessPill: vi.fn(),
      renderGuessPlaceholders: vi.fn(),
      clearHints: vi.fn(),
      setHints: vi.fn(),
      buildWikipediaUrl: vi.fn().mockReturnValue(''),
    };

    // roundTransitions stubs
    runtime.roundTransitions = {
      clearRoundTransition: vi.fn(),
      beginRoundTransition: vi.fn(),
      scrollStatusIntoView: vi.fn(),
    };

    // input stubs
    runtime.input = {
      clearForm: vi.fn(),
      validateInput: vi.fn().mockReturnValue(true),
      syncGuessButtonState: vi.fn(),
      populateContinentFilter: vi.fn(),
      isCountryInSelectedContinent: vi.fn().mockReturnValue(true),
    };

    // autoAdvance stub
    runtime.autoAdvance = {
      isEnabled: vi.fn().mockReturnValue(true),
    };

    // DOM elements needed by renderRoundState / submitGuess
    const make = (tag = 'div') => document.createElement(tag);
    runtime.dom.input = make('input');
    runtime.dom.revealTarget = make();
    runtime.dom.revealPanel = make();
    runtime.dom.revealBtn = make('button');
    runtime.dom.replayHaloBtn = make('button');
    runtime.dom.nextRoundBtn = make('button');
    runtime.dom.hintBtn = make('button');

    // config
    runtime.config.COPY = {
      feedback: {
        correct: 'Correct!',
        outOfGuesses: 'Out of guesses.',
        wrongPrefix: 'Wrong! ',
        wrongSuffix: ' left.',
        answerShown: 'The answer was shown.',
      },
      transitions: { loadingNextCountry: 'Loading next country' },
      input: { idlePlaceholder: 'Type a country...', lockedPlaceholder: 'Round over' },
    };
    runtime.config.ROUND_ADVANCE_MS = { correct: 3000, miss: 5000, reveal: 5000 };
    runtime.config.CORRECT_MSG_CLASS = 'correct';
    runtime.config.FAILURE_MSG_CLASS = 'failure';
    runtime.config.WRONG_MSG_CLASS = 'wrong';
    runtime.config.MAX_MISSES_PER_ROUND = 5;
    runtime.config.MAX_HINTS_PER_ROUND = 3;

    // store state
    const targetCountry = makeCountry();
    runtime.state.store = {
      targetCountry,
      countriesData: [targetCountry, makeCountry('Germany', 'DE'), makeCountry('Spain', 'ES')],
      selectedContinent: null,
      hasShownFirstRound: true,
      numCorrect: 0,
      numPlayed: 0,
      numHintsUsed: 0,
      round: { hintLevel: 0 },
    };

    runtime.state.targetSelector = {
      getNextTarget: vi.fn().mockReturnValue(makeCountry('Germany', 'DE')),
    };

    // Default mock for getRoundState — active round, hints remaining
    runtime.actions.getRoundState.mockReturnValue({
      outcome: ROUND_OUTCOME.active,
      missCount: 0,
      hintsRemaining: 3,
    });

    mod = await import('../../../../src/app/round/control.js');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- shim ---

  it('writes runtime.roundControl with expected methods', () => {
    const rc = runtime.roundControl;
    expect(typeof rc.submitGuess).toBe('function');
    expect(typeof rc.startRound).toBe('function');
    expect(typeof rc.revealAnswer).toBe('function');
    expect(typeof rc.showNextHint).toBe('function');
    expect(typeof rc.advanceToNextRound).toBe('function');
    expect(typeof rc.replayHalo).toBe('function');
    expect(typeof rc.renderRoundState).toBe('function');
    expect(typeof rc.resetAll).toBe('function');
  });

  // --- submitGuess — correct answer ---

  describe('submitGuess — correct answer', () => {
    beforeEach(() => {
      runtime.dom.input.value = 'France';
      runtime.actions.submitRoundGuess.mockReturnValue({ status: 'correct', remaining: 5 });
      runtime.actions.resolveCountryGuess.mockReturnValue(makeCountry('France'));
      runtime.actions.normalizeGuess.mockReturnValue('france');
    });

    it('calls submitRoundGuess with the input value', () => {
      mod.submitGuess();
      expect(runtime.actions.submitRoundGuess).toHaveBeenCalledWith('France', 5);
    });

    it('calls setFeedback with correct message and class', () => {
      mod.submitGuess();
      expect(runtime.roundUi.setFeedback).toHaveBeenCalledWith('Correct!', 'correct');
    });

    it('calls audioFeedback.correct', () => {
      mod.submitGuess();
      expect(runtime.audioFeedback.correct).toHaveBeenCalled();
    });

    it('schedules auto-advance when autoAdvance.isEnabled() is true', () => {
      runtime.autoAdvance.isEnabled.mockReturnValue(true);
      mod.submitGuess();
      expect(runtime.roundTransitions.beginRoundTransition).toHaveBeenCalled();
    });

    it('does not schedule auto-advance when autoAdvance.isEnabled() is false', () => {
      runtime.autoAdvance.isEnabled.mockReturnValue(false);
      mod.submitGuess();
      expect(runtime.roundTransitions.beginRoundTransition).not.toHaveBeenCalled();
    });
  });

  // --- submitGuess — wrong answer, round still active ---

  describe('submitGuess — wrong answer, round still active', () => {
    beforeEach(() => {
      runtime.dom.input.value = 'Germany';
      runtime.actions.submitRoundGuess.mockReturnValue({ status: 'wrong', remaining: 4 });
      runtime.actions.resolveCountryGuess.mockReturnValue(makeCountry('Germany', 'DE'));
    });

    it('calls audioFeedback.wrong', () => {
      mod.submitGuess();
      expect(runtime.audioFeedback.wrong).toHaveBeenCalled();
    });

    it('calls setFeedback with wrong-guess feedback', () => {
      mod.submitGuess();
      expect(runtime.roundUi.setFeedback).toHaveBeenCalledWith(
        expect.stringContaining('4'),
        'wrong'
      );
    });

    it('does not call beginRoundTransition (round still active)', () => {
      mod.submitGuess();
      expect(runtime.roundTransitions.beginRoundTransition).not.toHaveBeenCalled();
    });
  });

  // --- submitGuess — final wrong answer (missed) ---

  describe('submitGuess — final wrong answer (missed)', () => {
    beforeEach(() => {
      runtime.dom.input.value = 'Germany';
      runtime.actions.submitRoundGuess.mockReturnValue({ status: 'missed', remaining: 0 });
      runtime.actions.resolveCountryGuess.mockReturnValue(makeCountry('Germany', 'DE'));
    });

    it('calls audioFeedback.loss', () => {
      mod.submitGuess();
      expect(runtime.audioFeedback.loss).toHaveBeenCalled();
    });

    it('calls setFeedback with loss message and failure class', () => {
      mod.submitGuess();
      expect(runtime.roundUi.setFeedback).toHaveBeenCalledWith('Out of guesses.', 'failure');
    });

    it('does not auto-advance on loss (autoAdvance: false in finishRound)', () => {
      // handleGuess passes autoAdvance: false for missed outcome
      mod.submitGuess();
      expect(runtime.roundTransitions.beginRoundTransition).not.toHaveBeenCalled();
    });
  });

  // --- submitGuess — round not active ---

  describe('submitGuess — round not active', () => {
    it('does nothing when round outcome is not active', () => {
      runtime.actions.getRoundState.mockReturnValue({ outcome: ROUND_OUTCOME.won, hintsRemaining: 0 });
      runtime.dom.input.value = 'France';
      mod.submitGuess();
      expect(runtime.actions.submitRoundGuess).not.toHaveBeenCalled();
    });
  });

  // --- revealAnswer ---

  describe('revealAnswer', () => {
    it('calls setFeedback with reveal message', () => {
      runtime.actions.revealRoundAnswer.mockReturnValue({ changed: true, outcome: ROUND_OUTCOME.revealed });
      mod.revealAnswer();
      expect(runtime.roundUi.setFeedback).toHaveBeenCalledWith('The answer was shown.', 'failure');
    });

    it('does not play the win sound (correct)', () => {
      runtime.actions.revealRoundAnswer.mockReturnValue({ changed: true, outcome: ROUND_OUTCOME.revealed });
      mod.revealAnswer();
      expect(runtime.audioFeedback.correct).not.toHaveBeenCalled();
    });

    it('does nothing when targetCountry is not set', () => {
      runtime.state.store.targetCountry = null;
      mod.revealAnswer();
      expect(runtime.actions.revealRoundAnswer).not.toHaveBeenCalled();
    });

    it('does nothing when result.changed is false', () => {
      runtime.actions.revealRoundAnswer.mockReturnValue({ changed: false });
      mod.revealAnswer();
      expect(runtime.roundUi.setFeedback).not.toHaveBeenCalled();
    });
  });

  // --- startRound ---

  describe('startRound', () => {
    it('calls clearRoundTransition to clear prior transition', () => {
      mod.startRound();
      expect(runtime.roundTransitions.clearRoundTransition).toHaveBeenCalled();
    });

    it('calls clearFeedback', () => {
      mod.startRound();
      expect(runtime.roundUi.clearFeedback).toHaveBeenCalled();
    });

    it('calls clearHints', () => {
      mod.startRound();
      expect(runtime.roundUi.clearHints).toHaveBeenCalled();
    });

    it('calls renderGuessPlaceholders', () => {
      mod.startRound();
      expect(runtime.roundUi.renderGuessPlaceholders).toHaveBeenCalled();
    });

    it('calls actions.startRound with the next target name', () => {
      const nextTarget = makeCountry('Germany', 'DE');
      runtime.state.targetSelector.getNextTarget.mockReturnValue(nextTarget);
      mod.startRound();
      expect(runtime.actions.startRound).toHaveBeenCalledWith('Germany');
    });

    it('calls worldMapInst.markTarget with the next target', () => {
      const nextTarget = makeCountry('Germany', 'DE');
      runtime.state.targetSelector.getNextTarget.mockReturnValue(nextTarget);
      mod.startRound();
      expect(runtime.worldMapInst.markTarget).toHaveBeenCalledWith(nextTarget);
    });

    it('calls actions.incrementPlayed', () => {
      mod.startRound();
      expect(runtime.actions.incrementPlayed).toHaveBeenCalled();
    });

    it('does nothing when getNextTarget returns null', () => {
      runtime.state.targetSelector.getNextTarget.mockReturnValue(null);
      mod.startRound();
      expect(runtime.actions.startRound).not.toHaveBeenCalled();
    });

    it('schedules a roundReveal timer', () => {
      mod.startRound();
      expect(runtime.timers.isActive('roundReveal')).toBe(true);
    });

    it('calls worldMapInst.zoomToCountry after hasShownFirstRound is true', () => {
      runtime.state.store.hasShownFirstRound = true;
      mod.startRound();
      expect(runtime.worldMapInst.zoomToCountry).toHaveBeenCalled();
    });
  });

  // --- showNextHint ---

  describe('showNextHint', () => {
    it('calls setHints with revealed hints when result.changed is true', () => {
      const hints = [{ type: 'flag', value: '🇫🇷' }];
      runtime.actions.requestRoundHint.mockReturnValue({ changed: true, revealedHints: hints });
      mod.showNextHint();
      expect(runtime.roundUi.setHints).toHaveBeenCalledWith(hints);
    });

    it('does not call setHints when result.changed is false', () => {
      runtime.actions.requestRoundHint.mockReturnValue({ changed: false, revealedHints: [] });
      mod.showNextHint();
      expect(runtime.roundUi.setHints).not.toHaveBeenCalled();
    });
  });

  // --- replayHalo ---

  describe('replayHalo', () => {
    it('calls worldMapInst.showLocationHalo with the target country', () => {
      mod.replayHalo();
      expect(runtime.worldMapInst.showLocationHalo).toHaveBeenCalledWith(
        runtime.state.store.targetCountry,
        expect.objectContaining({ startTime: expect.any(Number) })
      );
    });

    it('does nothing when targetCountry is null', () => {
      runtime.state.store.targetCountry = null;
      mod.replayHalo();
      expect(runtime.worldMapInst.showLocationHalo).not.toHaveBeenCalled();
    });
  });

  // --- advanceToNextRound ---

  describe('advanceToNextRound', () => {
    it('calls clearRoundTransition then startRound', () => {
      mod.advanceToNextRound();
      expect(runtime.roundTransitions.clearRoundTransition).toHaveBeenCalled();
      expect(runtime.actions.startRound).toHaveBeenCalled();
    });
  });
});
