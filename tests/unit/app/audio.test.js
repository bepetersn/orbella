import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('audio', () => {
  let audioMod;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();

    const mockOscillator = {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
    const mockCtx = {
      state: 'running',
      currentTime: 0,
      destination: {},
      createOscillator: vi.fn().mockReturnValue(mockOscillator),
      createGain: vi.fn().mockReturnValue(mockGain),
      resume: vi.fn().mockResolvedValue(undefined),
    };
    window.AudioContext = vi.fn().mockReturnValue(mockCtx);
    delete window.webkitAudioContext;

    audioMod = await import('../../../src/audio.js');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('primeAudio is idempotent — calling multiple times does not throw', () => {
    expect(() => {
      audioMod.primeAudio();
      audioMod.primeAudio();
    }).not.toThrow();
  });

  it('correct does not throw when AudioContext is stubbed', () => {
    audioMod.primeAudio();
    expect(() => audioMod.correct()).not.toThrow();
  });

  it('wrong does not throw when AudioContext is stubbed', () => {
    audioMod.primeAudio();
    expect(() => audioMod.wrong()).not.toThrow();
  });

  it('loss does not throw when AudioContext is stubbed', () => {
    audioMod.primeAudio();
    expect(() => audioMod.loss()).not.toThrow();
  });
});
