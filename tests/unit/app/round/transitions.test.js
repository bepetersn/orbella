import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildRuntime } from '../../../fixtures/runtime-builder.js';

describe('round/transitions', () => {
  let mod;
  let runtime;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    runtime = await buildRuntime();

    // Replace timers stub with a real createTimerManager so schedule/cancel work
    const { createTimerManager } = await import('../../../../src/app/timerManager.js');
    runtime.timers = createTimerManager();

    // DOM stubs
    const make = () => document.createElement('div');
    runtime.dom.roundTransition = make();
    runtime.dom.roundTransitionFill = make();
    runtime.dom.roundTransitionLabel = make();

    mod = await import('../../../../src/app/round/transitions.js');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('clearRoundTransition', () => {
    it('resets progress bar to hidden state', () => {
      runtime.dom.roundTransition.classList.add('visible');
      mod.clearRoundTransition();
      expect(runtime.dom.roundTransition.classList.contains('visible')).toBe(false);
      expect(runtime.dom.roundTransitionFill.style.width).toBe('0%');
    });

    it('cancels any pending transition timers', () => {
      const fn = vi.fn();
      runtime.timers.schedule('roundTransition', fn, 1000);
      mod.clearRoundTransition();
      vi.advanceTimersByTime(2000);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('beginRoundTransition', () => {
    it('sets the label text', () => {
      mod.beginRoundTransition(500, 'Next round', () => {});
      expect(runtime.dom.roundTransitionLabel.textContent).toBe('Next round...');
    });

    it('fires the callback after the duration', () => {
      const fn = vi.fn();
      mod.beginRoundTransition(500, 'Loading', fn);
      vi.advanceTimersByTime(500);
      expect(fn).toHaveBeenCalledOnce();
    });

    it('clears a prior transition before starting a new one', () => {
      const first = vi.fn();
      const second = vi.fn();
      mod.beginRoundTransition(500, 'A', first);
      mod.beginRoundTransition(500, 'B', second);
      vi.advanceTimersByTime(500);
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledOnce();
    });
  });

  it('exports clearRoundTransition and beginRoundTransition as functions', () => {
    expect(typeof mod.clearRoundTransition).toBe('function');
    expect(typeof mod.beginRoundTransition).toBe('function');
  });
});
