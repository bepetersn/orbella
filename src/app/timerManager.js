/**
 * @fileoverview Named-timer manager factory.
 *
 * All timers are stored in a private Map keyed by a caller-chosen name.
 * Raw setTimeout IDs never escape into the caller's scope, which means:
 *
 *   - Double-cancel is always safe (idempotent by design).
 *   - Double-schedule on the same name cancels the prior timer automatically.
 *   - No module can accidentally overwrite or leak another module's timer by
 *     poking a shared mutable property.
 *   - Ownership is explicit: the name is the contract.
 *
 * API:
 *   schedule(name, fn, delay) – Cancel any pending timer named `name`, then
 *                               schedule `fn` to run after `delay` ms.
 *   cancel(name)              – Idempotent cancel. Safe whether or not a
 *                               timer is currently pending under `name`.
 *   cancelAll()               – Cancel every active timer (useful on teardown).
 *   isActive(name)            – Returns true iff a pending timer exists for
 *                               `name`. Use instead of a truthiness check on a
 *                               raw timer ID.
 *
 * Exposed globally as {@link window.createTimerManager}.
 */
export function createTimerManager() {
  const _timers = new Map();

  function cancel(name) {
    if (_timers.has(name)) {
      clearTimeout(_timers.get(name));
      _timers.delete(name);
    }
  }

  function schedule(name, fn, delay) {
    cancel(name);
    const id = setTimeout(() => {
      _timers.delete(name);
      fn();
    }, delay);
    _timers.set(name, id);
  }

  function cancelAll() {
    // Snapshot keys first — cancel() mutates the Map while iterating.
    for (const name of [..._timers.keys()]) {
      cancel(name);
    }
  }

  function isActive(name) {
    return _timers.has(name);
  }

  return { schedule, cancel, cancelAll, isActive };
}
