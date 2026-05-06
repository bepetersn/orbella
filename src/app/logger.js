/**
 * @fileoverview Shared debug logger.
 *
 * Respects the `window.__WORLDLE_DEBUG__` flag and `gameConfig.DEBUG` at call
 * time so the level can be toggled at runtime without a reload.
 */
import { gameConfig } from '../config.js';

function _isDebugEnabled() {
  try {
    return Boolean(window.__WORLDLE_DEBUG__ ?? gameConfig?.DEBUG);
  } catch {
    return Boolean(gameConfig && gameConfig.DEBUG);
  }
}

export const worldleLiteLogger = {
  debug: (...args) => { if (_isDebugEnabled()) { (console.debug || console.log).apply(console, args); } },
  info:  (...args) => { if (_isDebugEnabled()) { (console.info  || console.log).apply(console, args); } },
  warn:  (...args) => { (console.warn  || console.log).apply(console, args); },
  error: (...args) => { (console.error || console.log).apply(console, args); },
  group:    (...args) => { if (_isDebugEnabled() && console.group)    console.group(...args); },
  groupEnd: ()       => { if (_isDebugEnabled() && console.groupEnd) console.groupEnd(); }
};
