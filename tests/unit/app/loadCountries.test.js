import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createWorldleGlobe: vi.fn(),
  roundStartRound: vi.fn(),
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../src/app/round/index.js', () => ({
  round: {
    startRound: mocks.roundStartRound,
  },
}));

vi.mock('../../../src/config.js', () => ({
  gameConfig: {
    COUNTRIES_GEOJSON_URL: '/fallback-countries.json',
  },
}));

vi.mock('../../../src/map/globe.js', () => ({
  createWorldleGlobe: mocks.createWorldleGlobe,
}));

vi.mock('../../../src/app/logger.js', () => ({
  worldleLiteLogger: mocks.log,
}));

describe('loadAndInitCountries', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it('returns the map instance without mutating runtime.worldMapInst', async () => {
    const features = [{ properties: { name: 'France' } }, { properties: { name: 'Brazil' } }];
    const runtime = {
      BUILD_ID: 'build-123',
      actions: { loadCountriesIntoState: vi.fn() },
      input: { populateContinentFilter: vi.fn() },
    };
    const startup = {
      step: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const worldMapInst = { globe: { id: 'globe' } };

    globalThis.fetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue({ features }),
    });
    mocks.createWorldleGlobe.mockReturnValue(worldMapInst);

    const { loadAndInitCountries } = await import('../../../src/app/loadCountries.js');
    const result = await loadAndInitCountries({
      config: { COUNTRIES_GEOJSON_URL: '/countries.json' },
      runtime,
      _rt: {},
      startup,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/countries.json?v=build-123');
    expect(runtime.actions.loadCountriesIntoState).toHaveBeenCalledWith({
      countriesData: features,
      countryNames: ['Brazil', 'France'],
      countryByName: expect.any(Map),
    });
    expect(runtime.input.populateContinentFilter).toHaveBeenCalledWith(features);
    expect(result).toBe(worldMapInst);
    expect(runtime.worldMapInst).toBeUndefined();
    expect(mocks.roundStartRound).not.toHaveBeenCalled();
  });
});
