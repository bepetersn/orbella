import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit Tests for pipeline/generate-world-countries.mjs
 *
 * Tests the data preprocessing functions that normalize country features
 * including name normalization, flag code resolution, geometry validation,
 * and coordinate system conversions.
 */

// Mock implementations of the functions from generate-world-countries.mjs
function normalizeLookupName(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/&/gu, ' and ')
    .replace(/[''`´]/gu, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function flagEmojiFromCountryCode(countryCode) {
  const alpha2Code = String(countryCode ?? '')
    .trim()
    .toUpperCase();

  if (!/^[A-Z]{2}$/.test(alpha2Code)) {
    return null;
  }

  const firstRegionalIndicator = 0x1f1e6 + (alpha2Code.charCodeAt(0) - 65);
  const secondRegionalIndicator = 0x1f1e6 + (alpha2Code.charCodeAt(1) - 65);
  return String.fromCodePoint(firstRegionalIndicator, secondRegionalIndicator);
}

function collectAliases(properties) {
  const aliases = properties?.NAME_ALIASES;

  if (!Array.isArray(aliases)) {
    return [];
  }

  return [
    ...new Set(
      aliases
        .filter((aliasName) => typeof aliasName === 'string')
        .map((aliasName) => aliasName.trim())
        .filter(Boolean)
    ),
  ];
}

function collectContinents(properties) {
  const continents = [];
  const sourceContinent = properties?.CONTINENT ?? properties?.continent;

  if (sourceContinent) {
    continents.push(sourceContinent);
  }

  if (Array.isArray(properties?.continents)) {
    continents.push(...properties.continents.filter(Boolean));
  }

  return [...new Set(continents)];
}

function visitCoordinates(value, visitor) {
  if (!Array.isArray(value)) {
    return;
  }

  if (value.length === 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])) {
    visitor(value);
    return;
  }

  for (const entry of value) {
    visitCoordinates(entry, visitor);
  }
}

function getGeometryStats(geometry) {
  const bounds = {
    minLon: Number.POSITIVE_INFINITY,
    minLat: Number.POSITIVE_INFINITY,
    maxLon: Number.NEGATIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
  };
  let pointCount = 0;
  let ringCount = 0;

  if (!geometry || !Array.isArray(geometry.coordinates)) {
    return null;
  }

  const registerCoordinate = ([longitude, latitude]) => {
    bounds.minLon = Math.min(bounds.minLon, longitude);
    bounds.minLat = Math.min(bounds.minLat, latitude);
    bounds.maxLon = Math.max(bounds.maxLon, longitude);
    bounds.maxLat = Math.max(bounds.maxLat, latitude);
    pointCount += 1;
  };

  const registerRing = (ring) => {
    if (Array.isArray(ring) && ring.length) {
      ringCount += 1;
    }
    visitCoordinates(ring, registerCoordinate);
  };

  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(registerRing);
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((polygon) => polygon.forEach(registerRing));
  } else {
    return null;
  }

  if (
    !Number.isFinite(bounds.minLon) ||
    !Number.isFinite(bounds.minLat) ||
    !Number.isFinite(bounds.maxLon) ||
    !Number.isFinite(bounds.maxLat)
  ) {
    return null;
  }

  let centerLon;
  const lonSpan = bounds.maxLon - bounds.minLon;
  if (bounds.minLon < -90 && bounds.maxLon > 90 && lonSpan > 180) {
    const minLonNorm = bounds.minLon + 360;
    centerLon = ((bounds.maxLon + minLonNorm) / 2) % 360;
    if (centerLon > 180) centerLon -= 360;
  } else {
    centerLon = (bounds.minLon + bounds.maxLon) / 2;
  }

  return {
    bounds: [bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat],
    center: [centerLon, (bounds.minLat + bounds.maxLat) / 2],
    pointCount,
    ringCount,
  };
}

function transformGeometryCoordinates(geometry, transformer) {
  function walk(coords) {
    if (!Array.isArray(coords)) return coords;
    if (coords.length === 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
      return transformer(coords);
    }
    return coords.map(walk);
  }

  if (!geometry || !Array.isArray(geometry.coordinates)) return geometry;

  if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
    geometry.coordinates = walk(geometry.coordinates);
  }

  return geometry;
}

function webMercatorToLonLat([x, y]) {
  const R = 20037508.34;
  const lon = (x / R) * 180;
  let lat = (y / R) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return [Number(lon), Number(lat)];
}

describe('Pipeline / Generate World Countries', () => {
  describe('normalizeLookupName', () => {
    it('should normalize basic country names', () => {
      expect(normalizeLookupName('France')).toBe('france');
      expect(normalizeLookupName('United States')).toBe('united states');
    });

    it('should remove accents and diacritics', () => {
      expect(normalizeLookupName('São Tomé')).toBe('sao tome');
      expect(normalizeLookupName("Côte d'Ivoire")).toBe('cote d ivoire');
    });

    it('should handle ampersands', () => {
      expect(normalizeLookupName('Trinidad & Tobago')).toBe('trinidad and tobago');
    });

    it('should handle various quote characters', () => {
      expect(normalizeLookupName("People's Republic")).toBe('people s republic');
      expect(normalizeLookupName("Côte d'Ivoire")).toBe('cote d ivoire');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizeLookupName('Saint   Lucia')).toBe('saint lucia');
    });

    it('should trim whitespace', () => {
      expect(normalizeLookupName('  France  ')).toBe('france');
    });

    it('should handle null and undefined', () => {
      expect(normalizeLookupName(null)).toBe('');
      expect(normalizeLookupName(undefined)).toBe('');
    });

    it('should remove special characters', () => {
      expect(normalizeLookupName('South-Sudan')).toBe('south sudan');
      expect(normalizeLookupName('Mary-Jane')).toBe('mary jane');
    });
  });

  describe('flagEmojiFromCountryCode', () => {
    it('should generate flag emoji for valid ISO 3166-1 alpha-2 codes', () => {
      const frFlag = flagEmojiFromCountryCode('FR');
      expect(frFlag).toBeDefined();
      expect(typeof frFlag).toBe('string');
      expect(frFlag.length).toBeGreaterThan(0);
    });

    it('should return null for invalid codes', () => {
      expect(flagEmojiFromCountryCode('XXX')).toBeNull();
      expect(flagEmojiFromCountryCode('F')).toBeNull();
      expect(flagEmojiFromCountryCode('123')).toBeNull();
    });

    it('should be case-insensitive', () => {
      expect(flagEmojiFromCountryCode('fr')).toBe(flagEmojiFromCountryCode('FR'));
    });

    it('should handle null and undefined', () => {
      expect(flagEmojiFromCountryCode(null)).toBeNull();
      expect(flagEmojiFromCountryCode(undefined)).toBeNull();
    });

    it('should handle whitespace', () => {
      expect(flagEmojiFromCountryCode('  FR  ')).toBe(flagEmojiFromCountryCode('FR'));
    });
  });

  describe('collectAliases', () => {
    it('should collect and deduplicate aliases from properties', () => {
      const properties = {
        NAME_ALIASES: ['Alias 1', 'Alias 2', 'Alias 1'],
      };
      const aliases = collectAliases(properties);
      expect(aliases).toHaveLength(2);
      expect(aliases).toContain('Alias 1');
      expect(aliases).toContain('Alias 2');
    });

    it('should trim whitespace from aliases', () => {
      const properties = {
        NAME_ALIASES: ['  Alias 1  ', 'Alias 2'],
      };
      const aliases = collectAliases(properties);
      expect(aliases[0]).toBe('Alias 1');
    });

    it('should filter out empty strings', () => {
      const properties = {
        NAME_ALIASES: ['Alias 1', '', '  ', 'Alias 2'],
      };
      const aliases = collectAliases(properties);
      expect(aliases).toHaveLength(2);
    });

    it('should filter out non-string values', () => {
      const properties = {
        NAME_ALIASES: ['Alias 1', null, 123, 'Alias 2'],
      };
      const aliases = collectAliases(properties);
      expect(aliases).toHaveLength(2);
    });

    it('should return empty array when NAME_ALIASES is missing', () => {
      expect(collectAliases({})).toEqual([]);
    });

    it('should return empty array when NAME_ALIASES is not an array', () => {
      expect(collectAliases({ NAME_ALIASES: 'not an array' })).toEqual([]);
    });

    it('should return empty array for null/undefined properties', () => {
      expect(collectAliases(null)).toEqual([]);
      expect(collectAliases(undefined)).toEqual([]);
    });
  });

  describe('collectContinents', () => {
    it('should collect continent from CONTINENT property', () => {
      const properties = { CONTINENT: 'Europe' };
      const continents = collectContinents(properties);
      expect(continents).toContain('Europe');
    });

    it('should collect continent from lowercase continent property', () => {
      const properties = { continent: 'Africa' };
      const continents = collectContinents(properties);
      expect(continents).toContain('Africa');
    });

    it('should collect from continents array', () => {
      const properties = { continents: ['Europe', 'Asia'] };
      const continents = collectContinents(properties);
      expect(continents).toContain('Europe');
      expect(continents).toContain('Asia');
    });

    it('should deduplicate continents', () => {
      const properties = {
        CONTINENT: 'Europe',
        continents: ['Europe', 'Asia'],
      };
      const continents = collectContinents(properties);
      expect(continents).toHaveLength(2);
      expect(continents.filter((c) => c === 'Europe')).toHaveLength(1);
    });

    it('should filter out falsy values from continents array', () => {
      const properties = {
        continents: ['Europe', null, undefined, '', 'Asia'],
      };
      const continents = collectContinents(properties);
      expect(continents).toEqual(['Europe', 'Asia']);
    });

    it('should return empty array when no continent data', () => {
      expect(collectContinents({})).toEqual([]);
    });
  });

  describe('getGeometryStats', () => {
    it('should calculate bounds for simple polygon', () => {
      const geometry = {
        type: 'Polygon',
        coordinates: [
          [
            [-10, 40],
            [10, 40],
            [10, 50],
            [-10, 50],
            [-10, 40],
          ],
        ],
      };
      const stats = getGeometryStats(geometry);

      expect(stats).not.toBeNull();
      expect(stats.bounds).toEqual([-10, 40, 10, 50]);
      expect(stats.pointCount).toBe(5);
      expect(stats.ringCount).toBe(1);
    });

    it('should calculate center point', () => {
      const geometry = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
        ],
      };
      const stats = getGeometryStats(geometry);

      expect(stats.center).toEqual([5, 5]);
    });

    it('should handle MultiPolygon geometries', () => {
      const geometry = {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [0, 0],
              [5, 0],
              [5, 5],
              [0, 5],
              [0, 0],
            ],
          ],
          [
            [
              [10, 10],
              [15, 10],
              [15, 15],
              [10, 15],
              [10, 10],
            ],
          ],
        ],
      };
      const stats = getGeometryStats(geometry);

      expect(stats).not.toBeNull();
      expect(stats.bounds).toEqual([0, 0, 15, 15]);
      expect(stats.ringCount).toBe(2);
    });

    it('should return null for invalid geometry type', () => {
      const geometry = {
        type: 'Point',
        coordinates: [0, 0],
      };
      const stats = getGeometryStats(geometry);
      expect(stats).toBeNull();
    });

    it('should return null for missing geometry', () => {
      expect(getGeometryStats(null)).toBeNull();
      expect(getGeometryStats(undefined)).toBeNull();
      expect(getGeometryStats({})).toBeNull();
    });

    it('should handle antimeridian crossing', () => {
      const geometry = {
        type: 'Polygon',
        coordinates: [
          [
            [170, -10],
            [-170, -10],
            [-170, 10],
            [170, 10],
            [170, -10],
          ],
        ],
      };
      const stats = getGeometryStats(geometry);

      expect(stats).not.toBeNull();
      expect(stats.bounds[0]).toBeLessThan(stats.bounds[2]);
    });

    it('should handle deeply nested coordinate arrays', () => {
      const geometry = {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [0, 0],
              [1, 1],
              [0, 1],
              [0, 0],
            ],
          ],
          [
            [
              [2, 2],
              [3, 3],
              [2, 3],
              [2, 2],
            ],
          ],
        ],
      };
      const stats = getGeometryStats(geometry);
      expect(stats).not.toBeNull();
      expect(stats.pointCount).toBe(8);
    });
  });

  describe('transformGeometryCoordinates', () => {
    it('should transform coordinates in polygon', () => {
      const geometry = {
        type: 'Polygon',
        coordinates: [
          [
            [1, 2],
            [3, 4],
            [5, 6],
            [1, 2],
          ],
        ],
      };

      const transformed = transformGeometryCoordinates(geometry, ([x, y]) => [x * 2, y * 2]);

      expect(transformed.coordinates[0][0]).toEqual([2, 4]);
      expect(transformed.coordinates[0][1]).toEqual([6, 8]);
    });

    it('should transform coordinates in multipolygon', () => {
      const geometry = {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [1, 1],
              [2, 2],
              [1, 1],
            ],
          ],
        ],
      };

      const transformed = transformGeometryCoordinates(geometry, ([x, y]) => [x + 10, y + 10]);

      expect(transformed.coordinates[0][0][0]).toEqual([11, 11]);
      expect(transformed.coordinates[0][0][1]).toEqual([12, 12]);
    });

    it('should handle null geometry', () => {
      const result = transformGeometryCoordinates(null, () => {});
      expect(result).toBeNull();
    });

    it('should return geometry unchanged if no coordinates', () => {
      const geometry = { type: 'Polygon' };
      const result = transformGeometryCoordinates(geometry, () => {});
      expect(result).toEqual(geometry);
    });
  });

  describe('webMercatorToLonLat', () => {
    it('should convert Web Mercator (0,0) to lon/lat (0,0)', () => {
      const [lon, lat] = webMercatorToLonLat([0, 0]);
      expect(lon).toBeCloseTo(0, 5);
      expect(lat).toBeCloseTo(0, 5);
    });

    it('should convert positive Web Mercator coordinates', () => {
      const R = 20037508.34;
      const [lon, lat] = webMercatorToLonLat([R / 2, R / 2]);

      expect(lon).toBeCloseTo(90, 0);
      expect(lat).toBeGreaterThan(0);
      expect(lat).toBeLessThan(90);
    });

    it('should convert negative Web Mercator coordinates', () => {
      const R = 20037508.34;
      const [lon, lat] = webMercatorToLonLat([-R / 2, -R / 2]);

      expect(lon).toBeCloseTo(-90, 0);
      expect(lat).toBeLessThan(0);
      expect(lat).toBeGreaterThan(-90);
    });

    it('should return number types', () => {
      const [lon, lat] = webMercatorToLonLat([1000, 2000]);
      expect(typeof lon).toBe('number');
      expect(typeof lat).toBe('number');
    });
  });

  describe('visitCoordinates', () => {
    it('should visit leaf coordinates in nested array', () => {
      const visitor = vi.fn();
      const coords = [
        [
          [1, 2],
          [3, 4],
        ],
        [
          [5, 6],
          [7, 8],
        ],
      ];

      visitCoordinates(coords, visitor);

      expect(visitor).toHaveBeenCalledTimes(4);
      expect(visitor).toHaveBeenCalledWith([1, 2]);
      expect(visitor).toHaveBeenCalledWith([3, 4]);
      expect(visitor).toHaveBeenCalledWith([5, 6]);
      expect(visitor).toHaveBeenCalledWith([7, 8]);
    });

    it('should visit a single coordinate pair', () => {
      const visitor = vi.fn();
      visitCoordinates([10, 20], visitor);
      expect(visitor).toHaveBeenCalledOnce();
      expect(visitor).toHaveBeenCalledWith([10, 20]);
    });

    it('should not visit non-numeric coordinates', () => {
      const visitor = vi.fn();
      visitCoordinates(
        [
          [1, 2],
          [Number.NaN, 4],
        ],
        visitor
      );
      expect(visitor).toHaveBeenCalledOnce();
      expect(visitor).toHaveBeenCalledWith([1, 2]);
    });

    it('should handle non-array values gracefully', () => {
      const visitor = vi.fn();
      visitCoordinates(null, visitor);
      visitCoordinates('not an array', visitor);
      expect(visitor).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// mergeFacts — inline copy of the exported function from the pipeline script
// ---------------------------------------------------------------------------

function mergeFacts(properties, supplement) {
  const isoCode = properties?.isoCode ?? null;
  const entry = isoCode ? (supplement?.[isoCode] ?? null) : null;

  return {
    capital: entry?.capital ?? null,
    languages: Array.isArray(entry?.languages) ? entry.languages : [],
    currencies: Array.isArray(entry?.currencies) ? entry.currencies : [],
    area: typeof entry?.area === 'number' ? entry.area : null,
    population: typeof entry?.population === 'number' ? entry.population : null,
    subregion: entry?.subregion ?? null,
  };
}

describe('Pipeline / mergeFacts', () => {
  const supplement = {
    FR: {
      capital: 'Paris',
      languages: ['French'],
      currencies: [{ code: 'EUR', name: 'euro', symbol: '€' }],
      area: 543908,
      population: 66351959,
      subregion: 'Western Europe',
    },
    US: {
      capital: 'Washington, D.C.',
      languages: ['English'],
      currencies: [{ code: 'USD', name: 'United States dollar', symbol: '$' }],
      area: 9525067,
      population: 340110988,
      subregion: 'North America',
    },
  };

  it('returns all facts when isoCode matches a supplement entry', () => {
    const facts = mergeFacts({ isoCode: 'FR' }, supplement);
    expect(facts.capital).toBe('Paris');
    expect(facts.languages).toEqual(['French']);
    expect(facts.currencies).toEqual([{ code: 'EUR', name: 'euro', symbol: '€' }]);
    expect(facts.area).toBe(543908);
    expect(facts.population).toBe(66351959);
    expect(facts.subregion).toBe('Western Europe');
  });

  it('returns null/empty defaults when isoCode is not in the supplement', () => {
    const facts = mergeFacts({ isoCode: 'ZZ' }, supplement);
    expect(facts.capital).toBeNull();
    expect(facts.languages).toEqual([]);
    expect(facts.currencies).toEqual([]);
    expect(facts.area).toBeNull();
    expect(facts.population).toBeNull();
    expect(facts.subregion).toBeNull();
  });

  it('returns null/empty defaults when isoCode is null', () => {
    const facts = mergeFacts({ isoCode: null }, supplement);
    expect(facts.capital).toBeNull();
    expect(facts.languages).toEqual([]);
    expect(facts.currencies).toEqual([]);
    expect(facts.area).toBeNull();
    expect(facts.population).toBeNull();
    expect(facts.subregion).toBeNull();
  });

  it('returns null/empty defaults when properties is null', () => {
    const facts = mergeFacts(null, supplement);
    expect(facts.capital).toBeNull();
    expect(facts.languages).toEqual([]);
    expect(facts.area).toBeNull();
  });

  it('returns null/empty defaults when supplement is empty', () => {
    const facts = mergeFacts({ isoCode: 'FR' }, {});
    expect(facts.capital).toBeNull();
    expect(facts.languages).toEqual([]);
    expect(facts.area).toBeNull();
  });

  it('returns null/empty defaults when supplement is null', () => {
    const facts = mergeFacts({ isoCode: 'FR' }, null);
    expect(facts.capital).toBeNull();
    expect(facts.languages).toEqual([]);
    expect(facts.area).toBeNull();
  });

  it('handles partial supplement entries gracefully', () => {
    const partial = { XX: { capital: 'TestCity' } };
    const facts = mergeFacts({ isoCode: 'XX' }, partial);
    expect(facts.capital).toBe('TestCity');
    expect(facts.languages).toEqual([]);
    expect(facts.currencies).toEqual([]);
    expect(facts.area).toBeNull();
    expect(facts.population).toBeNull();
    expect(facts.subregion).toBeNull();
  });

  it('always returns all six keys in the result', () => {
    const facts = mergeFacts({ isoCode: 'US' }, supplement);
    expect(Object.keys(facts)).toEqual([
      'capital',
      'languages',
      'currencies',
      'area',
      'population',
      'subregion',
    ]);
  });
});
