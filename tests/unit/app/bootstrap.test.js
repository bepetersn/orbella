import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bindEventListeners: vi.fn(),
  initializeAutoAdvance: vi.fn(),
  initializeCopy: vi.fn(),
  initializeSettings: vi.fn(),
  installDebugHelpers: vi.fn(),
  loadAndInitCountries: vi.fn(),
  queryDomElements: vi.fn(() => ({ themeToggle: null, autoAdvanceToggle: null })),
  resolveDebugMode: vi.fn(() => false),
  roundStartRound: vi.fn(),
  createTimerManager: vi.fn(() => ({})),
  createTargetSelector: vi.fn(() => ({})),
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../src/app/round/ui.js', () => ({}));
vi.mock('../../../src/app/input.js', () => ({}));
vi.mock('../../../src/app/round/transitions.js', () => ({}));
vi.mock('../../../src/app/dom.js', () => ({
  queryDomElements: mocks.queryDomElements,
}));
vi.mock('../../../src/app/timerManager.js', () => ({
  createTimerManager: mocks.createTimerManager,
}));
vi.mock('../../../src/config.js', () => ({
  gameConfig: { BUILD_ID: 'cfg-build', COPY: {}, DEBUG: false },
  COPY: {},
}));
vi.mock('../../../src/constants.js', () => ({
  gameConstants: {},
}));
vi.mock('../../../src/store/index.js', () => ({
  gameStore: {
    state: {},
    dispatch: vi.fn(),
    ROUND_OUTCOME: {},
    ACTIONS: {},
  },
}));
vi.mock('../../../src/targetSelector.js', () => ({
  createTargetSelector: mocks.createTargetSelector,
}));
vi.mock('../../../src/audio.js', () => ({}));
vi.mock('../../../src/theme.js', () => ({}));
vi.mock('../../../src/app/debug.js', () => ({
  resolveDebugMode: mocks.resolveDebugMode,
  installDebugHelpers: mocks.installDebugHelpers,
}));
vi.mock('../../../src/app/loadCountries.js', () => ({
  loadAndInitCountries: mocks.loadAndInitCountries,
}));
vi.mock('../../../src/app/logger.js', () => ({
  worldleLiteLogger: mocks.logger,
}));
vi.mock('../../../src/app/autoAdvance.js', () => ({
  initializeAutoAdvance: mocks.initializeAutoAdvance,
}));
vi.mock('../../../src/app/bindings.js', () => ({
  initializeCopy: mocks.initializeCopy,
  bindEventListeners: mocks.bindEventListeners,
}));
vi.mock('../../../src/app/settings.js', () => ({
  initialize: mocks.initializeSettings,
}));
vi.mock('../../../src/app/round/index.js', () => ({
  round: {
    startRound: mocks.roundStartRound,
  },
}));

describe('bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    globalThis.window = globalThis;
    delete window.worldleLiteRuntime;
    delete window.__WORLDLE_DEBUG__;
  });

  it('assigns worldMapInst before installing debug helpers and starting the round', async () => {
    const calls = [];
    const worldMapInst = { globe: { id: 'globe' } };
    const runtime = {
      actions: {},
      config: { COPY: {}, DEBUG: false },
      dom: { themeToggle: null, autoAdvanceToggle: null },
      startup: { step: vi.fn() },
      themeSystem: { initializeTheme: vi.fn() },
      timers: {},
    };

    mocks.loadAndInitCountries.mockImplementation(async ({ runtime: activeRuntime }) => {
      calls.push(['load', activeRuntime.worldMapInst ?? null]);
      return worldMapInst;
    });
    mocks.installDebugHelpers.mockImplementation(() => {
      calls.push(['debug', window.worldleLiteRuntime?.worldMapInst ?? null]);
    });
    mocks.roundStartRound.mockImplementation(() => {
      calls.push(['round', window.worldleLiteRuntime?.worldMapInst ?? null]);
    });

    const { bootstrap } = await import('../../../src/app/bootstrap.js');
    await bootstrap(runtime);

    expect(runtime.worldMapInst).toBe(worldMapInst);
    expect(calls).toEqual([
      ['load', null],
      ['debug', worldMapInst],
      ['round', worldMapInst],
    ]);
    expect(runtime.startup.step).toHaveBeenCalledWith('first round started');
  });
});
