import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildRuntime } from '../../../fixtures/runtime-builder.js';

describe('round/ui', () => {
  let mod;
  let runtime;

  beforeEach(async () => {
    vi.resetModules();
    runtime = buildRuntime();

    // Set up DOM stubs in runtime.dom
    const make = (tag = 'div') => document.createElement(tag);
    runtime.dom.feedback = make();
    runtime.dom.feedback.hidden = true;
    runtime.dom.scoreCorrect = make();
    runtime.dom.scorePlayed = make();
    runtime.dom.hintsUsedInRound = make();
    runtime.dom.totalHintsUsed = make();
    runtime.dom.input = make('input');
    runtime.dom.guessList = make();
    runtime.dom.hintText = make();
    runtime.dom.hintUsage = make();
    runtime.state.store = { numCorrect: 3, numPlayed: 7, numHintsUsed: 2, round: { hintLevel: 1 } };
    runtime.config.CORRECT_MSG_CLASS = 'correct';
    runtime.config.MAX_MISSES_PER_ROUND = 5;
    runtime.config.MAX_HINTS_PER_ROUND = 3;
    runtime.config.GUESS_PILL_CLASS = 'guess-pill';
    runtime.config.COPY = {
      hints: {
        flag: 'Flag: {flag}',
        firstLetter: 'First: {letter}',
        letterCount: 'Letters: {count}',
        separator: ' | ',
      },
    };

    mod = await import('../../../../src/app/round/ui.js');
  });

  describe('setFeedback / clearFeedback', () => {
    it('setFeedback shows text and applies class', () => {
      mod.setFeedback('Correct!', 'correct');
      expect(runtime.dom.feedback.textContent).toBe('Correct!');
      expect(runtime.dom.feedback.className).toBe('correct');
      expect(runtime.dom.feedback.hidden).toBe(false);
    });

    it('clearFeedback resets text, class, and hides element', () => {
      mod.setFeedback('x', 'y');
      mod.clearFeedback();
      expect(runtime.dom.feedback.textContent).toBe('');
      expect(runtime.dom.feedback.className).toBe('');
      expect(runtime.dom.feedback.hidden).toBe(true);
    });
  });

  describe('updateStats', () => {
    it('renders numCorrect and numPlayed into the score elements', () => {
      mod.updateStats();
      expect(runtime.dom.scoreCorrect.textContent).toBe('3');
      expect(runtime.dom.scorePlayed.textContent).toBe('7');
    });
  });

  describe('shakeInput', () => {
    it('adds and later removes the shake class', async () => {
      vi.useFakeTimers();
      mod.shakeInput();
      expect(runtime.dom.input.classList.contains('shake')).toBe(true);
      vi.advanceTimersByTime(400);
      expect(runtime.dom.input.classList.contains('shake')).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('buildWikipediaUrl', () => {
    it('builds a proper Wikipedia URL', () => {
      expect(mod.buildWikipediaUrl('New Zealand')).toBe(
        'https://en.wikipedia.org/wiki/New_Zealand'
      );
    });

    it('returns empty string for empty name', () => {
      expect(mod.buildWikipediaUrl('')).toBe('');
    });
  });

  describe('renderGuessPlaceholders', () => {
    it('creates one empty pill per MAX_MISSES_PER_ROUND', () => {
      mod.renderGuessPlaceholders();
      expect(runtime.dom.guessList.children.length).toBe(5);
      expect(runtime.dom.guessList.children[0].classList.contains('empty')).toBe(true);
    });
  });
});
