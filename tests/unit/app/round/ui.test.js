import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildRuntime } from '../../../fixtures/runtime-builder.js';

describe('round/ui', () => {
  let mod;
  let runtime;

  beforeEach(async () => {
    vi.resetModules();
    runtime = await buildRuntime();

    // Set up DOM stubs in runtime.dom
    const make = (tag = 'div') => document.createElement(tag);
    runtime.dom.feedback = make();
    runtime.dom.feedback.hidden = true;
    runtime.dom.scoreCorrect = make();
    runtime.dom.scorePlayed = make();
    runtime.dom.hintsUsedInRound = make();
    runtime.dom.totalHintsUsed = make();
    runtime.dom.celebration = make();
    runtime.dom.celebration.classList.add('active');
    runtime.dom.celebration.setAttribute('aria-hidden', 'false');
    runtime.dom.celebrationText = make();
    runtime.dom.confettiLayer = make();
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

  describe('celebration', () => {
    it('clearCelebration resets the celebration UI and cancels the timer', () => {
      runtime.dom.celebrationText.textContent = 'Great job';
      runtime.dom.confettiLayer.innerHTML = '<span>confetti</span>';

      mod.clearCelebration();

      expect(runtime.timers.cancel).toHaveBeenCalledWith('celebration');
      expect(runtime.dom.celebration.classList.contains('active')).toBe(false);
      expect(runtime.dom.celebration.getAttribute('aria-hidden')).toBe('true');
      expect(runtime.dom.celebrationText.textContent).toBe('');
      expect(runtime.dom.confettiLayer.innerHTML).toBe('');
    });

    it('showCelebration populates the message, confetti, and clear timer', () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.25);

      mod.showCelebration('You got it!');

      expect(runtime.dom.celebration.classList.contains('active')).toBe(true);
      expect(runtime.dom.celebration.getAttribute('aria-hidden')).toBe('false');
      expect(runtime.dom.celebrationText.textContent).toBe('You got it!');
      expect(runtime.dom.confettiLayer.children).toHaveLength(36);
      expect(runtime.timers.schedule).toHaveBeenCalledWith(
        'celebration',
        expect.any(Function),
        2400
      );

      const clearCallback = runtime.timers.schedule.mock.calls[0][1];
      clearCallback();
      expect(runtime.dom.celebration.classList.contains('active')).toBe(false);

      randomSpy.mockRestore();
    });
  });

  describe('hints', () => {
    it('formats all supported hint types into the hint text', () => {
      mod.setHints([
        { type: 'flag', value: '🇫🇷' },
        { type: 'first-letter', value: 'F' },
        { type: 'letter-count', value: 6 },
        { type: 'unknown', value: 'ignored' },
      ]);

      expect(runtime.dom.hintText.textContent).toBe('Flag: 🇫🇷 | First: F | Letters: 6');
    });

    it('clearHints empties the hint container', () => {
      runtime.dom.hintText.textContent = 'Flag: 🇫🇷';

      mod.clearHints();

      expect(runtime.dom.hintText.textContent).toBe('');
    });

    it('updateHintUsage reflects the current round hint count', () => {
      mod.updateHintUsage();
      expect(runtime.dom.hintUsage.textContent).toBe('Hints this round: 1/3');
    });
  });

  describe('renderLinkedCountryName', () => {
    it('renders a link with the expected target and rel attributes', () => {
      const container = document.createElement('div');

      mod.renderLinkedCountryName(container, 'New Zealand', 'guess-name-link');

      const link = container.querySelector('a');
      expect(link).not.toBeNull();
      expect(link.className).toBe('guess-name-link');
      expect(link.href).toBe('https://en.wikipedia.org/wiki/New_Zealand');
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener noreferrer');
      expect(link.textContent).toBe('New Zealand');
    });
  });

  describe('fillNextGuessPill', () => {
    beforeEach(() => {
      mod.renderGuessPlaceholders();
    });

    it('renders a correct guess with a flag and linked country name', () => {
      mod.fillNextGuessPill(
        {
          properties: {
            displayName: 'France',
            flagEmoji: '🇫🇷',
          },
        },
        'correct'
      );

      const pill = runtime.dom.guessList.children[0];
      expect(pill.classList.contains('correct')).toBe(true);
      expect(pill.dataset.result).toBe('correct');
      expect(pill.getAttribute('aria-label')).toBe('Correct guess: France');
      expect(pill.querySelector('.flag-badge')?.textContent).toBe('🇫🇷');
      expect(pill.querySelector('.guess-name-link')?.textContent).toBe('France');
    });

    it('renders a wrong guess with adjacency proximity text', () => {
      mod.fillNextGuessPill('Spain', 'guess', {
        adjacent: true,
        arrow: '→',
      });

      const pill = runtime.dom.guessList.children[0];
      expect(pill.classList.contains('guess')).toBe(true);
      expect(pill.querySelector('.guess-name')?.textContent).toBe('Spain');
      expect(pill.querySelector('.proximity-badge')?.textContent).toBe('→ Adjacent');
      expect(pill.querySelector('.proximity-badge')?.getAttribute('aria-label')).toBe(
        'Adjacent to the target'
      );
    });

    it('renders a wrong guess with formatted long-distance text', () => {
      mod.fillNextGuessPill(
        {
          properties: {
            name: 'Argentina',
            flagEmoji: '🇦🇷',
          },
        },
        'guess',
        {
          distanceKm: 2400,
          arrow: '↗',
        }
      );

      const pill = runtime.dom.guessList.children[0];
      expect(pill.querySelector('.flag-badge')?.textContent).toBe('🇦🇷');
      expect(pill.querySelector('.guess-name')?.textContent).toBe('Argentina');
      expect(pill.querySelector('.proximity-badge')?.textContent).toBe('↗ 2.4k km');
      expect(pill.querySelector('.proximity-badge')?.getAttribute('aria-label')).toBe(
        '2.4k km away'
      );
    });
  });
});
