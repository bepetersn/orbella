import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { drawHaloFrame, project3DToScreen, resolveCentroid } from '../../../src/map/globe-halo.js';
import { lonLatTo3D } from '../../../src/map/utils.js';

describe('Map / Globe Halo helpers', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.THREE;
  });

  it('resolveCentroid prefers precomputed geometryCenter', () => {
    const centroid = resolveCentroid({
      properties: { geometryCenter: [12, 34] },
    });

    expect(centroid).toEqual({ lat: 34, lng: 12 });
  });

  it('lonLatTo3D projects coordinates to the unit sphere', () => {
    expect(lonLatTo3D(0, 0)).toEqual({ x: 1, y: 0, z: 0 });
    expect(lonLatTo3D(90, 0).z).toBeCloseTo(1, 6);
    expect(lonLatTo3D(0, 90).y).toBeCloseTo(1, 6);
  });

  it('project3DToScreen converts projected coordinates into canvas pixels', () => {
    window.THREE = {
      Vector3: class {
        constructor(x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
        }

        project() {
          this.x = 0.25;
          this.y = -0.5;
          this.z = 0.5;
          return this;
        }
      },
    };

    const result = project3DToScreen(
      {
        scene: () => ({}),
        camera: () => ({}),
        renderer: () => ({ domElement: {} }),
      },
      { width: 200, height: 100 },
      { x: 1, y: 2, z: 3 }
    );

    expect(result).toEqual({ x: 125, y: 75 });
  });

  it('drawHaloFrame removes expired and invalid halos while drawing active ones', () => {
    const ctx = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      globalAlpha: 1,
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 0,
    };
    const halos = [
      {
        screenX: 40,
        screenY: 50,
        startTime: 900,
        duration: 1000,
        maxRadius: 40,
        easing: 'linear',
        color: '#fff',
      },
      {
        screenX: Number.NaN,
        screenY: 30,
        startTime: 900,
        duration: 1000,
        maxRadius: 40,
        easing: 'linear',
        color: '#fff',
      },
      {
        screenX: 10,
        screenY: 20,
        startTime: 0,
        duration: 500,
        maxRadius: 40,
        easing: 'linear',
        color: '#fff',
      },
    ];

    drawHaloFrame(
      ctx,
      halos,
      1000,
      (name) => {
        expect(name).toBe('linear');
        return (t) => t;
      },
      { canvas: { width: 200, height: 100 }, debug: vi.fn() }
    );

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 200, 100);
    expect(ctx.arc).toHaveBeenCalled();
    expect(halos).toHaveLength(1);
    expect(halos[0].screenX).toBe(40);
    expect(ctx.globalAlpha).toBe(1);
  });
});
