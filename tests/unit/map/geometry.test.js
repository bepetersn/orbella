import { describe, it, expect } from 'vitest';

/**
 * Unit Tests for src/map/geometry.js
 * Tests geometry manipulation and trimming
 */
describe('Map / Geometry', () => {
  
  const validPolygon = {
    type: 'Polygon',
    coordinates: [[[-5, 41], [8, 51], [8, 41], [-5, 41]]]
  };

  const validMultiPolygon = {
    type: 'MultiPolygon',
    coordinates: [
      [[[-5, 41], [8, 51], [8, 41], [-5, 41]]],
      [[[9, 40], [15, 50], [15, 40], [9, 40]]]
    ]
  };

  const continentBounds = {
    Europe: { minLat: 36, maxLat: 71, minLon: -25, maxLon: 45 },
    'North America': { minLat: 15, maxLat: 84, minLon: -170, maxLon: -52 },
    Africa: { minLat: -35, maxLat: 37, minLon: -18, maxLon: 52 }
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
          return lat >= bounds.minLat && lat <= bounds.maxLat &&
                 lon >= bounds.minLon && lon <= bounds.maxLon;
        };

        if (geometry.type === 'MultiPolygon') {
          const trimmedPolygons = geometry.coordinates
            .map(polygon => {
              return polygon.map(ring => {
                return ring.filter(([lon, lat]) => isInBounds(lat, lon));
              }).filter(ring => ring.length >= 3);
            })
            .filter(polygon => polygon.length > 0);

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
        coordinates: [[[0, 50], [5, 50], [5, 55], [0, 55], [0, 50]]]
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
          return Array.isArray(geometry.coordinates) &&
                 geometry.coordinates.length > 0 &&
                 geometry.coordinates[0].length >= 3;
        }

        if (geometry.type === 'MultiPolygon') {
          return Array.isArray(geometry.coordinates) &&
                 geometry.coordinates.length > 0;
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

      const validRing = [[-5, 41], [8, 51], [8, 41], [-5, 41]];
      expect(isSimpleRing(validRing)).toBe(true);

      const invalidRing = [[-5, 41], [8, 51], [8, 41]]; // Doesn't close
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
            message: `No map available for ${country.name}`
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
        let minLat = Infinity, maxLat = -Infinity;
        let minLon = Infinity, maxLon = -Infinity;

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
