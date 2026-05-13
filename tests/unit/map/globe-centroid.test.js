import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('globe.gl', () => ({
  default: class GlobeMock {},
}));

import {
  applyGlobeExclusionsTop,
  buildProcessedFeaturesTop,
  centroidFromPropertiesTop,
  centroidFromRingTop,
  formatGlobeDebugLinesTop,
  getCountryCentroidTop,
  largestGeometryRingTop,
  markTargetTop,
  readGlobeDebugSnapshotTop,
} from '../../../src/map/globe.js';

// France-like fixture: small part first (French Guiana), large part second (metropolitan France).
const franceLike = {
  properties: {
    name: 'France',
    // These precomputed bounds/center are intentionally wrong (include French Guiana)
    // to verify we no longer rely on them.
    geometryCenter: [-22.48, 26.6],
    geometryBounds: [-54.52, 2.05, 9.56, 51.15],
  },
  geometry: {
    type: 'MultiPolygon',
    coordinates: [
      // Part 0: French Guiana — small ring, 4 points
      [
        [
          [-54.5, 2.1],
          [-51.7, 2.1],
          [-51.7, 5.8],
          [-54.5, 2.1],
        ],
      ],
      // Part 1: Metropolitan France — larger ring, 6 points
      [
        [
          [-4.6, 42.3],
          [8.1, 42.3],
          [8.1, 51.1],
          [2.0, 51.1],
          [-2.0, 48.0],
          [-4.6, 42.3],
        ],
      ],
      // Part 2: Corsica — tiny ring, 3 points
      [
        [
          [8.5, 41.4],
          [9.6, 43.0],
          [8.5, 43.0],
        ],
      ],
    ],
  },
};

describe('getCountryCentroidTop', () => {
  it('ignores precomputed geometryCenter and uses geometry directly', () => {
    const centroid = getCountryCentroidTop(franceLike);
    expect(centroid).not.toBeNull();
    // Should NOT be in the mid-Atlantic (the wrong geometryCenter value)
    expect(centroid.lng).not.toBeCloseTo(-22.48, 0);
    expect(centroid.lat).not.toBeCloseTo(26.6, 0);
  });

  it('picks the largest polygon part (metropolitan France, not French Guiana)', () => {
    const centroid = getCountryCentroidTop(franceLike);
    expect(centroid).not.toBeNull();
    // Metropolitan France centroid should be in western Europe: lon ~1-3, lat ~46-47
    expect(centroid.lng).toBeGreaterThan(-10);
    expect(centroid.lng).toBeLessThan(15);
    expect(centroid.lat).toBeGreaterThan(40);
    expect(centroid.lat).toBeLessThan(55);
  });

  it('returns correct centroid for a simple Polygon', () => {
    // Ring: [0,0],[4,0],[4,4],[0,4],[0,0] — 5 points including closing point
    // avg lon = (0+4+4+0+0)/5 = 1.6, avg lat = (0+0+4+4+0)/5 = 1.6
    const simple = {
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
            [0, 0],
          ],
        ],
      },
    };
    const centroid = getCountryCentroidTop(simple);
    expect(centroid).not.toBeNull();
    expect(centroid.lng).toBeCloseTo(1.6, 1);
    expect(centroid.lat).toBeCloseTo(1.6, 1);
  });

  it('uses precomputed geometryCenter for simple Polygon features', () => {
    const withCenter = {
      properties: { geometryCenter: [10.0, 50.0] },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 0],
          ],
        ],
      },
    };
    const centroid = getCountryCentroidTop(withCenter);
    expect(centroid).toEqual({ lat: 50.0, lng: 10.0 });
  });

  it('ignores precomputed geometryCenter for MultiPolygon features', () => {
    const withCenter = {
      properties: { geometryCenter: [-22.48, 26.6] }, // bad mid-Atlantic value
      geometry: franceLike.geometry,
    };
    const centroid = getCountryCentroidTop(withCenter);
    expect(centroid).not.toBeNull();
    expect(centroid.lng).not.toBeCloseTo(-22.48, 0);
  });

  it('returns null for a feature with no geometry', () => {
    expect(getCountryCentroidTop({ properties: {} })).toBeNull();
    expect(getCountryCentroidTop(null)).toBeNull();
  });
});

describe('centroid helper splits', () => {
  it('uses precomputed property centroid only for non-multipolygons', () => {
    expect(centroidFromPropertiesTop({ geometryCenter: [12, 34] }, false)).toEqual({
      lat: 34,
      lng: 12,
    });
    expect(centroidFromPropertiesTop({ geometryCenter: [12, 34] }, true)).toBeNull();
  });

  it('selects the largest ring for multipolygon geometry', () => {
    expect(largestGeometryRingTop(franceLike.geometry)).toEqual(
      franceLike.geometry.coordinates[1][0]
    );
  });

  it('computes a centroid from a ring and ignores invalid points', () => {
    const centroid = centroidFromRingTop([
      [0, 0],
      [4, 0],
      ['bad', 1],
      [4, 4],
      [0, 4],
      [0, 0],
    ]);

    expect(centroid).toEqual({ lat: 1.6, lng: 1.6 });
  });
});

describe('debug helper splits', () => {
  it('reads a debug snapshot from the globe', () => {
    const computeBoundingSphere = vi.fn();
    const globe = {
      pointOfView: () => ({ lat: 1, lng: 2, altitude: 3 }),
      camera: () => ({ position: { x: 3, y: 4, z: 12 }, fov: 45 }),
      scene: () => ({
        children: [
          {
            type: 'Mesh',
            geometry: {
              boundingSphere: { radius: 2 },
              computeBoundingSphere,
            },
            scale: { x: 1.5 },
          },
        ],
      }),
    };

    const snapshot = readGlobeDebugSnapshotTop(globe);

    expect(snapshot.pov).toEqual({ lat: 1, lng: 2, altitude: 3 });
    expect(snapshot.radius).toBe(3);
    expect(snapshot.ratio).toBeCloseTo(13 / 3, 6);
    expect(computeBoundingSphere).not.toHaveBeenCalled();
  });

  it('formats the debug snapshot into the panel text', () => {
    expect(
      formatGlobeDebugLinesTop({
        pov: { lat: 1.2345, lng: 2.3456, altitude: 1.8 },
        cam: { position: { z: 8 }, fov: 40 },
        radius: 2,
        ratio: 4,
      })
    ).toContain('lat=1.234,lng=2.346,alt=1.800');
  });
});

describe('applyGlobeExclusionsTop', () => {
  it('removes excluded multipolygon parts and collapses to Polygon when one remains', () => {
    const feature = {
      properties: { name: 'France' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: franceLike.geometry.coordinates,
      },
    };
    const excludedBounds = new Map([
      [
        'france',
        [
          [-60, 0, -40, 10],
          [8, 41, 10, 44],
        ],
      ],
    ]);

    const result = applyGlobeExclusionsTop(feature, excludedBounds);

    expect(result.geometry.type).toBe('Polygon');
    expect(result.geometry.coordinates).toEqual(franceLike.geometry.coordinates[1]);
  });

  it('returns the original feature when no bounds match', () => {
    const feature = {
      properties: { name: 'France' },
      geometry: franceLike.geometry,
    };

    expect(applyGlobeExclusionsTop(feature, new Map())).toBe(feature);
  });
});

describe('buildProcessedFeaturesTop', () => {
  it('returns the original array when flipping is disabled', () => {
    const features = [{ properties: { name: 'Test' }, geometry: { type: 'Point' } }];

    expect(buildProcessedFeaturesTop(features, false)).toBe(features);
  });

  it('flips longitudes recursively without mutating the source features', () => {
    const features = [
      {
        properties: { name: 'Flip Me' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [10, 20],
              [30, 40],
              [10, 20],
            ],
          ],
        },
      },
    ];

    const result = buildProcessedFeaturesTop(features, true);

    expect(result).not.toBe(features);
    expect(result[0].geometry.coordinates[0][0]).toEqual([-10, 20]);
    expect(result[0].geometry.coordinates[0][1]).toEqual([-30, 40]);
    expect(features[0].geometry.coordinates[0][0]).toEqual([10, 20]);
  });
});

describe('markTargetTop', () => {
  let globe;
  let data;

  beforeEach(() => {
    data = [
      {
        properties: { name: 'France', _target: true },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [4, 0],
              [4, 4],
              [0, 0],
            ],
          ],
        },
      },
      {
        properties: { name: 'Spain', _target: false },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-4, 40],
              [0, 40],
              [0, 44],
              [-4, 40],
            ],
          ],
        },
      },
    ];

    globe = {
      polygonsData: vi.fn((next) => {
        if (next) {
          data = next;
        }
        return data;
      }),
      pointOfView: vi.fn(),
    };
  });

  it('clears existing targets, marks the new one, and pans to its centroid', () => {
    markTargetTop(globe, { properties: { name: 'Spain' } });

    expect(data[0].properties._target).toBe(false);
    expect(data[1].properties._target).toBe(true);
    expect(globe.polygonsData).toHaveBeenCalledWith(data);
    expect(globe.pointOfView).toHaveBeenCalledWith(
      expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number), altitude: 1.8 }),
      600
    );
  });
});
