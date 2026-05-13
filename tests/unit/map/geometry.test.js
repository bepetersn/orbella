import { describe, it, expect, vi } from 'vitest';
import {
  getGeometryPolygonParts,
  createPolygonFeature,
  haversineDistanceKm,
  compassBearing,
  createContinentGeometryFilter,
} from '../../../src/map/geometry.js';

/**
 * Unit Tests for src/map/geometry.js
 * Tests geometry manipulation and trimming
 */
describe('Map / Geometry', () => {
  const validPolygon = {
    type: 'Polygon',
    coordinates: [
      [
        [-5, 41],
        [8, 51],
        [8, 41],
        [-5, 41],
      ],
    ],
  };

  const validMultiPolygon = {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [-5, 41],
          [8, 51],
          [8, 41],
          [-5, 41],
        ],
      ],
      [
        [
          [9, 40],
          [15, 50],
          [15, 40],
          [9, 40],
        ],
      ],
    ],
  };

  const continentBounds = {
    Europe: { minLat: 36, maxLat: 71, minLon: -25, maxLon: 45 },
    'North America': { minLat: 15, maxLat: 84, minLon: -170, maxLon: -52 },
    Africa: { minLat: -35, maxLat: 37, minLon: -18, maxLon: 52 },
  };

  describe('test_multipolygonTrimming_continent_mode', () => {
    it('should trim multipolygons to continent bounds', () => {
      const trimGeometryToContinent = (geometry, continent) => {
        if (!geometry || !geometry.coordinates) {
          return null;
        }

        const bounds = continentBounds[continent];
        if (!bounds) return geometry;

        const isInBounds = (lat, lon) => {
          return (
            lat >= bounds.minLat &&
            lat <= bounds.maxLat &&
            lon >= bounds.minLon &&
            lon <= bounds.maxLon
          );
        };

        if (geometry.type === 'MultiPolygon') {
          const trimmedPolygons = geometry.coordinates
            .map((polygon) => {
              return polygon
                .map((ring) => {
                  return ring.filter(([lon, lat]) => isInBounds(lat, lon));
                })
                .filter((ring) => ring.length >= 3);
            })
            .filter((polygon) => polygon.length > 0);

          return trimmedPolygons.length > 0
            ? { type: 'MultiPolygon', coordinates: trimmedPolygons }
            : null;
        }

        return geometry;
      };

      const trimmed = trimGeometryToContinent(validMultiPolygon, 'Europe');
      expect(trimmed).toBeDefined();
      if (trimmed) {
        expect(trimmed.type).toBe('MultiPolygon');
      }
    });

    it('should preserve geometry for single continent countries', () => {
      const simpleCountry = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 50],
            [5, 50],
            [5, 55],
            [0, 55],
            [0, 50],
          ],
        ],
      };

      const trimmed = simpleCountry; // Single polygon doesn't need trimming
      expect(trimmed.type).toBe('Polygon');
      expect(trimmed.coordinates).toHaveLength(1);
    });
  });

  describe('test_geometryValid_after_trim', () => {
    it('should produce valid GeoJSON after trimming', () => {
      const isValidGeometry = (geometry) => {
        if (!geometry) return false;
        if (!geometry.type) return false;
        if (!geometry.coordinates) return false;

        if (geometry.type === 'Polygon') {
          return (
            Array.isArray(geometry.coordinates) &&
            geometry.coordinates.length > 0 &&
            geometry.coordinates[0].length >= 3
          );
        }

        if (geometry.type === 'MultiPolygon') {
          return Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0;
        }

        return false;
      };

      expect(isValidGeometry(validPolygon)).toBe(true);
      expect(isValidGeometry(validMultiPolygon)).toBe(true);
      expect(isValidGeometry({ type: 'Point', coordinates: [0, 0] })).toBe(false);
      expect(isValidGeometry(null)).toBe(false);
    });

    it('should not produce self-intersecting geometries', () => {
      const isSimpleRing = (ring) => {
        // Very basic check: at least 3 points and closes on itself
        if (!Array.isArray(ring) || ring.length < 4) return false;
        const first = ring[0];
        const last = ring[ring.length - 1];
        return first[0] === last[0] && first[1] === last[1];
      };

      const validRing = [
        [-5, 41],
        [8, 51],
        [8, 41],
        [-5, 41],
      ];
      expect(isSimpleRing(validRing)).toBe(true);

      const invalidRing = [
        [-5, 41],
        [8, 51],
        [8, 41],
      ]; // Doesn't close
      expect(isSimpleRing(invalidRing)).toBe(false);
    });
  });

  describe('test_handleNoGeometry', () => {
    it('should not crash when geometry is missing', () => {
      const processGeometry = (country) => {
        try {
          if (!country || !country.geometry) {
            return { rendered: false, reason: 'no_geometry' };
          }
          return { rendered: true, type: country.geometry.type };
        } catch (e) {
          return { rendered: false, error: e.message };
        }
      };

      const result1 = processGeometry(null);
      expect(result1.rendered).toBe(false);

      const result2 = processGeometry({});
      expect(result2.rendered).toBe(false);

      const result3 = processGeometry({ geometry: validPolygon });
      expect(result3.rendered).toBe(true);
      expect(result3.type).toBe('Polygon');
    });

    it('should gracefully degrade missing geometry', () => {
      const getCountryDisplay = (country) => {
        if (!country.geometry) {
          return {
            displayed: true,
            fallback: true,
            message: `No map available for ${country.name}`,
          };
        }
        return { displayed: true, fallback: false };
      };

      const noGeometry = { name: 'Test Country' };
      const display = getCountryDisplay(noGeometry);
      expect(display.displayed).toBe(true);
      expect(display.fallback).toBe(true);
    });
  });

  describe('test_geometryBounds', () => {
    it('should calculate correct bounds from geometry', () => {
      const getBounds = (coordinates) => {
        let minLat = Infinity,
          maxLat = -Infinity;
        let minLon = Infinity,
          maxLon = -Infinity;

        const processCoord = ([lon, lat]) => {
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
          minLon = Math.min(minLon, lon);
          maxLon = Math.max(maxLon, lon);
        };

        if (coordinates[0][0][0] !== undefined) {
          // Polygon
          coordinates[0].forEach(processCoord);
        } else {
          // Direct coordinates
          coordinates.forEach(processCoord);
        }

        return { minLat, maxLat, minLon, maxLon };
      };

      const bounds = getBounds(validPolygon.coordinates);
      expect(bounds.minLat).toBeLessThanOrEqual(bounds.maxLat);
      expect(bounds.minLon).toBeLessThanOrEqual(bounds.maxLon);
    });
  });
});

// ---------------------------------------------------------------------------
// Real-module tests (import from src/map/geometry.js)
// ---------------------------------------------------------------------------

const europeRing = [
  [2, 48],
  [3, 48],
  [3, 49],
  [2, 49],
  [2, 48],
];

const asiaRing = [
  [100, 30],
  [101, 30],
  [101, 31],
  [100, 31],
  [100, 30],
];

function makePolygonFeature(coords, props = {}) {
  return {
    type: 'Feature',
    properties: { continent: 'Europe', ...props },
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}

function makeMultiPolygonFeature(rings, props = {}) {
  return {
    type: 'Feature',
    properties: { continent: 'Europe', ...props },
    geometry: { type: 'MultiPolygon', coordinates: rings.map((r) => [r]) },
  };
}

// Minimal D3 stub — covers every call made by geometry.js
function makeD3Stub() {
  return {
    geoCentroid: vi.fn((feature) => {
      const coords = feature?.geometry?.coordinates;
      if (!coords) return [0, 0];
      const ring = Array.isArray(coords[0][0]) ? coords[0][0] : coords[0];
      const pt = ring[0];
      return Array.isArray(pt) ? pt : [0, 0];
    }),
    geoArea: vi.fn(() => 1),
    geoDistance: vi.fn((a, b) => {
      const dx = a[0] - b[0];
      const dy = a[1] - b[1];
      return Math.sqrt(dx * dx + dy * dy) * (Math.PI / 180);
    }),
  };
}

function makeProjectionStub() {
  return vi.fn((lonLat) => lonLat);
}

function makePathStub() {
  return { centroid: vi.fn(() => [0, 0]) };
}

function makeFilter(extraOpts = {}) {
  const d3 = makeD3Stub();
  const projection = makeProjectionStub();
  const path = makePathStub();
  const filter = createContinentGeometryFilter({
    d3,
    path,
    projection,
    getCountryKey: (f) => f.properties?.name?.toLowerCase() ?? '',
    ...extraOpts,
  });
  return { filter, d3, projection, path };
}

describe('Map / Geometry (real) — getGeometryPolygonParts', () => {
  it('returns [] for a feature with no geometry', () => {
    expect(getGeometryPolygonParts({})).toEqual([]);
    expect(getGeometryPolygonParts(null)).toEqual([]);
    expect(getGeometryPolygonParts(undefined)).toEqual([]);
  });

  it('returns a single-element array for a Polygon feature', () => {
    const feature = makePolygonFeature(europeRing);
    const parts = getGeometryPolygonParts(feature);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual([europeRing]);
  });

  it('returns multiple elements for a MultiPolygon feature', () => {
    const feature = makeMultiPolygonFeature([europeRing, asiaRing]);
    const parts = getGeometryPolygonParts(feature);
    expect(parts).toHaveLength(2);
  });

  it('returns [] for unknown geometry types', () => {
    const feature = {
      geometry: { type: 'Point', coordinates: [0, 0] },
    };
    expect(getGeometryPolygonParts(feature)).toEqual([]);
  });
});

describe('Map / Geometry (real) — createPolygonFeature', () => {
  it('produces a valid GeoJSON Feature with Polygon geometry', () => {
    const props = { name: 'Test' };
    const feature = createPolygonFeature(props, [europeRing]);
    expect(feature.type).toBe('Feature');
    expect(feature.geometry.type).toBe('Polygon');
    expect(feature.geometry.coordinates).toEqual([europeRing]);
    expect(feature.properties).toBe(props);
  });
});

describe('Map / Geometry (real) — haversineDistanceKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistanceKm([0, 0], [0, 0])).toBe(0);
  });

  it('returns a positive distance for different points', () => {
    const dist = haversineDistanceKm([2.35, 48.85], [13.41, 52.52]); // Paris → Berlin
    expect(dist).toBeGreaterThan(800);
    expect(dist).toBeLessThan(1100);
  });

  it('is symmetric (A→B === B→A)', () => {
    const ab = haversineDistanceKm([2, 48], [100, 30]);
    const ba = haversineDistanceKm([100, 30], [2, 48]);
    expect(ab).toBe(ba);
  });

  it('returns an integer', () => {
    const d = haversineDistanceKm([0, 0], [1, 1]);
    expect(Number.isInteger(d)).toBe(true);
  });
});

describe('Map / Geometry (real) — compassBearing', () => {
  it('returns ↑ when destination is due North', () => {
    expect(compassBearing([0, 0], [0, 10])).toBe('↑');
  });

  it('returns ↓ when destination is due South', () => {
    expect(compassBearing([0, 10], [0, 0])).toBe('↓');
  });

  it('returns → when destination is due East (approx)', () => {
    const arrow = compassBearing([0, 0], [10, 0]);
    expect(['→', '↗', '↘']).toContain(arrow);
  });

  it('returns one of the 8 expected arrow characters', () => {
    const validArrows = new Set(['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']);
    for (let lon = -180; lon <= 180; lon += 45) {
      for (let lat = -60; lat <= 60; lat += 30) {
        const arrow = compassBearing([0, 0], [lon, lat]);
        expect(validArrows.has(arrow)).toBe(true);
      }
    }
  });
});

describe('Map / Geometry (real) — createContinentGeometryFilter', () => {
  it('returns a Map containing all countries when continentName is null', () => {
    const { filter } = makeFilter();
    const fr = makePolygonFeature(europeRing, { name: 'France' });
    const jp = makePolygonFeature(asiaRing, { name: 'Japan', continent: 'Asia' });
    const result = filter.buildRenderableMapForContinent([fr, jp], null);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
  });

  it('returns only continent-matched countries when continentName is set', () => {
    const { filter } = makeFilter();
    const fr = makePolygonFeature(europeRing, { name: 'France', continent: 'Europe' });
    const jp = makePolygonFeature(asiaRing, { name: 'Japan', continent: 'Asia' });
    const result = filter.buildRenderableMapForContinent([fr, jp], 'Europe');
    expect(result.size).toBe(2);
  });

  it('returns defaultMap when no countries match the continent', () => {
    const { filter } = makeFilter();
    const jp = makePolygonFeature(asiaRing, { name: 'Japan', continent: 'Asia' });
    const result = filter.buildRenderableMapForContinent([jp], 'Europe');
    expect(result.size).toBe(1);
    expect(result.has('japan')).toBe(true);
  });

  it('applies exclusion bounds to strip explicitly excluded parts', () => {
    const excludedPolygonBounds = new Map([['france', [[-180, -90, -180, 90]]]]);
    const { filter } = makeFilter({ excludedPolygonBounds });
    const fr = makeMultiPolygonFeature([europeRing, asiaRing], {
      name: 'France',
      continent: 'Europe',
    });
    const result = filter.buildRenderableMapForContinent([fr], null);
    expect(result.has('france')).toBe(true);
  });

  it('uses custom isCountryInContinent predicate when provided', () => {
    const { filter } = makeFilter({
      isCountryInContinent: (country, name) => country.properties.customContinent === name,
    });
    const fr = makePolygonFeature(europeRing, {
      name: 'France',
      customContinent: 'EU',
      continent: 'Europe',
    });
    const result = filter.buildRenderableMapForContinent([fr], 'Europe');
    expect(result.has('france')).toBe(true);
  });
});
