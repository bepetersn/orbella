/**
 * Tests for src/map/constants.js — imports and asserts on the REAL exported values.
 */
import { describe, it, expect } from 'vitest';
import {
  ZOOM_DURATION_MS,
  ZOOM_PROPORTIONAL_SCALE_FACTOR,
  ZOOM_MAX_SCALE_DEFAULT,
  ZOOM_MAX_SCALE_SMALL_COUNTRY,
  SMALL_COUNTRY_AREA_THRESHOLD,
  ZOOM_VIEWPORT_PADDING_RATIO,
  HALO_SIZE_THRESHOLD,
  HALO_STROKE_COLOR,
  HALO_STROKE_WIDTH,
  HALO_DURATION_MS,
  HALO_RADIUS,
} from '../../../src/map/constants.js';

describe('Map / Constants (real)', () => {
  describe('zoom constants', () => {
    it('ZOOM_DURATION_MS is a positive number', () => {
      expect(typeof ZOOM_DURATION_MS).toBe('number');
      expect(ZOOM_DURATION_MS).toBeGreaterThan(0);
    });

    it('ZOOM_PROPORTIONAL_SCALE_FACTOR is between 0 and 1', () => {
      expect(ZOOM_PROPORTIONAL_SCALE_FACTOR).toBeGreaterThan(0);
      expect(ZOOM_PROPORTIONAL_SCALE_FACTOR).toBeLessThanOrEqual(1);
    });

    it('ZOOM_MAX_SCALE_SMALL_COUNTRY is larger than ZOOM_MAX_SCALE_DEFAULT', () => {
      expect(ZOOM_MAX_SCALE_SMALL_COUNTRY).toBeGreaterThan(ZOOM_MAX_SCALE_DEFAULT);
    });

    it('ZOOM_MAX_SCALE_DEFAULT is a positive number', () => {
      expect(ZOOM_MAX_SCALE_DEFAULT).toBeGreaterThan(0);
    });

    it('SMALL_COUNTRY_AREA_THRESHOLD is a positive number', () => {
      expect(SMALL_COUNTRY_AREA_THRESHOLD).toBeGreaterThan(0);
    });

    it('ZOOM_VIEWPORT_PADDING_RATIO is between 0 and 1', () => {
      expect(ZOOM_VIEWPORT_PADDING_RATIO).toBeGreaterThan(0);
      expect(ZOOM_VIEWPORT_PADDING_RATIO).toBeLessThan(1);
    });
  });

  describe('halo constants', () => {
    it('HALO_SIZE_THRESHOLD is a positive number', () => {
      expect(typeof HALO_SIZE_THRESHOLD).toBe('number');
      expect(HALO_SIZE_THRESHOLD).toBeGreaterThan(0);
    });

    it('HALO_STROKE_COLOR is a CSS color string', () => {
      expect(typeof HALO_STROKE_COLOR).toBe('string');
      expect(HALO_STROKE_COLOR.length).toBeGreaterThan(0);
    });

    it('HALO_STROKE_WIDTH is a positive number', () => {
      expect(typeof HALO_STROKE_WIDTH).toBe('number');
      expect(HALO_STROKE_WIDTH).toBeGreaterThan(0);
    });

    it('HALO_DURATION_MS is a positive number', () => {
      expect(typeof HALO_DURATION_MS).toBe('number');
      expect(HALO_DURATION_MS).toBeGreaterThan(0);
    });

    it('HALO_RADIUS is a positive number', () => {
      expect(typeof HALO_RADIUS).toBe('number');
      expect(HALO_RADIUS).toBeGreaterThan(0);
    });
  });
});
