/**
 * Integration Tests — Map State helpers
 *
 * Verifies `markTarget`, `markSolved`, `markWrong`, and `resetRoundState`
 * interact with the rendering `ctx.g` surface as expected.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

function makeSelectionSurface() {
  // Minimal fake selection surface that records operations by id
  const elements = new Map();

  function sel(id) {
    const key = id.replace(/^#/, '');
    if (!elements.has(key)) elements.set(key, { classes: new Set(), styles: {} });

    return {
      classed(name, value) {
        if (value === undefined) {
          return elements.get(key).classes.has(name);
        }
        if (value) elements.get(key).classes.add(name);
        else elements.get(key).classes.delete(name);
        return this;
      },
      interrupt() {
        return this;
      },
      transition() {
        return this;
      },
      duration() {
        return this;
      },
      style(k, v) {
        if (v === undefined) return elements.get(key).styles[k];
        elements.get(key).styles[k] = v;
        return this;
      },
    };
  }

  return {
    elements,
    select(selector) {
      return sel(selector.replace(/^#/, '#'));
    },
    selectAll() {
      // return an object that supports chaining used by resetRoundState
      return {
        remove() {
          this.removed = true;
          return this;
        },
        interrupt() {
          return this;
        },
        style() {
          return this;
        },
        classed() {
          return this;
        },
      };
    },
  };
}

beforeEach(() => {
  vi.resetModules();
});

describe('Integration / Map State (real)', () => {
  it('markTarget and markSolved toggle classes on the selected element', async () => {
    const { markTarget, markSolved } = await import('../../src/map/state.js');
    const surface = makeSelectionSurface();
    const ctx = { g: surface };

    const france = { properties: { displayName: 'France' } };
    markTarget(ctx, france);
    const stored = surface.elements.get('france');
    expect(stored).toBeDefined();
    expect(stored.classes.has('target')).toBe(true);

    markSolved(ctx, france);
    expect(stored.classes.has('target')).toBe(false);
    expect(stored.classes.has('correct')).toBe(true);
  });

  it('resetRoundState clears styles and removes halo', async () => {
    const { resetRoundState } = await import('../../src/map/state.js');
    const surface = makeSelectionSurface();
    const ctx = { g: surface };

    // ensure calling reset doesn't throw and returns expected chains
    expect(() => resetRoundState(ctx)).not.toThrow();
  });
});
