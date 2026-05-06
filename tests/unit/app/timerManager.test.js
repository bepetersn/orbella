import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTimerManager } from '../../../src/app/timerManager.js';

describe('timerManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedule fires callback after delay', () => {
    const tm = createTimerManager();
    const fn = vi.fn();
    tm.schedule('test', fn, 100);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('cancel prevents callback from firing', () => {
    const tm = createTimerManager();
    const fn = vi.fn();
    tm.schedule('test', fn, 100);
    tm.cancel('test');
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it('cancel is idempotent — safe to call on nonexistent name', () => {
    const tm = createTimerManager();
    expect(() => tm.cancel('doesNotExist')).not.toThrow();
    expect(() => tm.cancel('doesNotExist')).not.toThrow();
  });

  it('cancelAll clears all active timers', () => {
    const tm = createTimerManager();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    tm.schedule('a', fn1, 100);
    tm.schedule('b', fn2, 200);
    tm.cancelAll();
    vi.advanceTimersByTime(300);
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });

  it('double-schedule on same name cancels the prior timer', () => {
    const tm = createTimerManager();
    const first = vi.fn();
    const second = vi.fn();
    tm.schedule('x', first, 100);
    tm.schedule('x', second, 100);
    vi.advanceTimersByTime(200);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('isActive returns true while timer is pending and false after it fires', () => {
    const tm = createTimerManager();
    tm.schedule('y', () => {}, 100);
    expect(tm.isActive('y')).toBe(true);
    vi.advanceTimersByTime(100);
    expect(tm.isActive('y')).toBe(false);
  });

  it('isActive returns false for unknown name', () => {
    const tm = createTimerManager();
    expect(tm.isActive('nope')).toBe(false);
  });
});
