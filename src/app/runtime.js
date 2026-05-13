/**
 * @fileoverview Module singleton for the worldle-lite runtime object.
 *
 * Provides a single shared reference to the runtime that is set once during
 * bootstrap and read by all app modules.  Throws on uninitialized access so
 * bugs surface immediately rather than silently propagating as empty-object
 * reads.
 *
 * Usage (production):
 *   import { setRuntime } from './runtime.js';
 *   setRuntime(runtime); // called once in bootstrap()
 *
 * Usage (consumers):
 *   import { getRuntime } from './runtime.js';
 *   const dom = getRuntime().dom;
 *
 * Usage (tests):
 *   import { setRuntime } from '../../src/app/runtime.js';
 *   setRuntime(stubbedRuntime); // called in beforeEach via runtime-builder
 */

/** @type {object|null} */
let _runtime = null;

/**
 * Store the runtime object.  Called once by bootstrap() after the runtime is
 * fully assembled.
 *
 * @param {object} runtime
 */
export function setRuntime(runtime) {
  _runtime = runtime;
}

/**
 * Retrieve the runtime object.
 * @throws {Error} If called before setRuntime().
 * @returns {object}
 */
export function getRuntime() {
  if (!_runtime) {
    // Fall back to the window-backed reference so that the runtime installed by
    // buildRuntime() in tests survives vi.resetModules() clearing this module.
    if (typeof window !== 'undefined' && window.worldleLiteRuntime) {
      return window.worldleLiteRuntime;
    }
    throw new Error(
      '[runtime] getRuntime() called before setRuntime(). ' +
        'Ensure bootstrap() has run before any module reads the runtime.'
    );
  }
  return _runtime;
}
