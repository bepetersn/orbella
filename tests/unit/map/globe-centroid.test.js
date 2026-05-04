import { describe, it, expect } from 'vitest';

/**
 * Unit tests for getCountryCentroidTop logic in globe.js.
 *
 * We extract and test the centroid algorithm directly here to guard against
 * regressions where precomputed properties (geometryCenter / geometryBounds)
 * include excluded polygon parts and pull the centroid to the wrong location.
 */

// Inline the function under test (mirrors the implementation in globe.js).
// When the implementation changes, update here too.
function getCountryCentroidTop(country) {
  try {
    const isMulti = country?.geometry?.type === 'MultiPolygon';
    const p = country && country.properties;
    if (!isMulti) {
      if (p && Array.isArray(p.geometryCenter) && p.geometryCenter.length >= 2) {
        return { lat: p.geometryCenter[1], lng: p.geometryCenter[0] };
      }
      if (p && Array.isArray(p.geometryBounds) && p.geometryBounds.length >= 4) {
        const [minLon, minLat, maxLon, maxLat] = p.geometryBounds;
        return { lat: (minLat + maxLat) / 2, lng: (minLon + maxLon) / 2 };
      }
    }
    if (country && country.geometry) {
      let ring = null;
      if (country.geometry.type === 'MultiPolygon') {
        let best = null, bestLen = -1;
        for (const poly of country.geometry.coordinates) {
          const r = poly[0];
          if (Array.isArray(r) && r.length > bestLen) { best = r; bestLen = r.length; }
        }
        ring = best;
      } else if (country.geometry.type === 'Polygon') {
        ring = country.geometry.coordinates[0];
      }
      const parts = ring;
      if (Array.isArray(parts) && parts.length) {
        let sumLon = 0, sumLat = 0, count = 0;
        for (const pt of parts) {
          if (Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1])) {
            sumLon += pt[0]; sumLat += pt[1]; count += 1;
          }
        }
        if (count > 0) return { lat: sumLat / count, lng: sumLon / count };
      }
    }
  } catch (e) { /* ignore */ }
  return null;
}

// France-like fixture: small part first (French Guiana), large part second (metropolitan France).
const franceLike = {
  properties: {
    name: 'France',
    // These precomputed bounds/center are intentionally wrong (include French Guiana)
    // to verify we no longer rely on them.
    geometryCenter: [-22.48, 26.60],
    geometryBounds: [-54.52, 2.05, 9.56, 51.15],
  },
  geometry: {
    type: 'MultiPolygon',
    coordinates: [
      // Part 0: French Guiana — small ring, 4 points
      [[[-54.5, 2.1], [-51.7, 2.1], [-51.7, 5.8], [-54.5, 2.1]]],
      // Part 1: Metropolitan France — larger ring, 6 points
      [[[-4.6, 42.3], [8.1, 42.3], [8.1, 51.1], [2.0, 51.1], [-2.0, 48.0], [-4.6, 42.3]]],
      // Part 2: Corsica — tiny ring, 3 points
      [[[8.5, 41.4], [9.6, 43.0], [8.5, 43.0]]],
    ]
  }
};

describe('getCountryCentroidTop', () => {
  it('ignores precomputed geometryCenter and uses geometry directly', () => {
    const centroid = getCountryCentroidTop(franceLike);
    expect(centroid).not.toBeNull();
    // Should NOT be in the mid-Atlantic (the wrong geometryCenter value)
    expect(centroid.lng).not.toBeCloseTo(-22.48, 0);
    expect(centroid.lat).not.toBeCloseTo(26.60, 0);
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
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]] }
    };
    const centroid = getCountryCentroidTop(simple);
    expect(centroid).not.toBeNull();
    expect(centroid.lng).toBeCloseTo(1.6, 1);
    expect(centroid.lat).toBeCloseTo(1.6, 1);
  });

  it('uses precomputed geometryCenter for simple Polygon features', () => {
    const withCenter = {
      properties: { geometryCenter: [10.0, 50.0] },
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [4, 0], [4, 4], [0, 0]]] }
    };
    const centroid = getCountryCentroidTop(withCenter);
    expect(centroid).toEqual({ lat: 50.0, lng: 10.0 });
  });

  it('ignores precomputed geometryCenter for MultiPolygon features', () => {
    const withCenter = {
      properties: { geometryCenter: [-22.48, 26.60] },  // bad mid-Atlantic value
      geometry: franceLike.geometry
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
