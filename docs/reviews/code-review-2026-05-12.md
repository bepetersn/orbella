# Code Review: `worldle-lite`

*— Your Angry TL, Return Visit*

The first review told you what was wrong. Some things were fixed. Many were not. New things were introduced. Let's talk about all of them.

---

### 🔥 `globe.js` claims to be "deliberately simple and maintainable" — it is 951 lines

The very first line of `src/map/globe.js`:

> *"Lightweight Globe.gl initializer — deliberately simple and maintainable."*

This file has a cyclomatic complexity of 77 in its main function. It is 951 lines long. The word "lightweight" is not a style choice; it is a **lie**. Delete that comment or fix the file. You cannot have both.

---

### 🔥 `control.js` has hidden game-breaking state that is never reset

```js
const solvedCountriesByRegion = new Map();
const celebratedRegions = new Set();
```

These two module-level singletons accumulate state across rounds **and across new games**. When a player clicks "New Game," the store resets. The target selector resets. But `solvedCountriesByRegion` and `celebratedRegions` do not. If a player solves every country in Europe, starts a new game, and solves one European country, they will never see the "You solved every country" celebration again because `celebratedRegions` still has `'Europe'` in it from the previous game.

This is a bug disguised as a module architecture choice. These belong in the store, or at minimum they must be cleared in `startRound` when a new game begins. Right now they are invisible, persistent, and wrong.

---

### 🔥 `debug.js` defines its own `getRuntime()` that bypasses the real one

`src/app/runtime.js` exports `getRuntime()`. Every other module in `src/app/` imports and uses it. `debug.js` ignores that entirely and defines its own:

```js
function getRuntime() {
  return window.worldleLiteRuntime;
}
```

There is a purpose-built abstraction **in the same folder** that already handles the window fallback, throws a useful error on uninitialized access, and is the correct thing to use. `debug.js` bypasses it to read the window global directly. This means debug.js silently returns `undefined` instead of throwing a useful error if bootstrap hasn't run. It also means that if you ever change where the runtime lives, you have to remember to update this private copy too.

Import `getRuntime` from `'../runtime.js'` like every other module does. Delete the local definition.

---

### 🔥 The double-call pattern from `bootstrap.js` was fixed — by moving it to `bindings.js`

The first review called out this exact pattern in `bootstrap.js`:

```js
window.worldleLiteDebug?.bindDebugToggle?.();
bindDebugToggle();
```

That was fixed. Here is the same pattern, now in `bindings.js`:

```js
window.worldleLiteDebug?.syncDebugToggleUi?.();
syncDebugToggleUi();
```

Back to back. Same function, called twice, one through the global and one directly. The fix was to copy the bug somewhere else. Pick one call path. Remove the other.

---

### 🔥 `constants.js` has a "backward-compat shim" that has no removal plan

```js
// Backward-compat shim — remove once all callers use import
window.gameConstants = gameConstants;
```

Who are the callers that still need the global? `globe.js` — that's who. Look at the top of `globe.js`:

```js
const constants = window.gameConstants?.COUNTRY_COLORS ?? FALLBACK_COUNTRY_COLORS;
```

And then `globe.js` defines `FALLBACK_COUNTRY_COLORS` — a full duplicate of the color palette from `constants.js` — because it reads the global through optional chaining and needs a fallback for when the global isn't there yet. So: `constants.js` writes a global, `globe.js` reads that global, and `globe.js` also hardcodes all the same values as a fallback because the global might not be populated at read time. You have the same data in three places — the module, the global, and the fallback. If you change a color, you have two other places to update. `globe.js` even has a comment acknowledging this:

> *"If the palette changes there, update here too."*

That comment is an admission of defeat. `globe.js` should import from `constants.js` directly. The global shim should die.

---

### 🔥 `ui.js` and `input.js` self-register on `window.worldleLiteRuntime` at import time

```js
// ui.js — module top level, runs on import
if (typeof window !== 'undefined' && window.worldleLiteRuntime) {
  window.worldleLiteRuntime.roundUi = { setFeedback, clearFeedback, ... };
}
```

```js
// input.js — module top level, runs on import
if (typeof window !== 'undefined' && window.worldleLiteRuntime) {
  window.worldleLiteRuntime.input = { validateInput, clearForm, ... };
}
```

The previous review said: *"You are using the `window` object as a makeshift module registry inside an ES module project with a bundler."* The `window._gameStore` bus was removed, which was the right call. But these two modules are doing the same thing at a smaller scale — reaching out to a global object at import time and writing themselves onto it. This is import-time side effects mutating shared global state, which is the exact pattern that made the original architecture fragile.

`bootstrap.js` already assigns `runtime.roundUi = roundUiModule` explicitly during assembly. The self-registration shim in `ui.js` and `input.js` is redundant in production and exists only to paper over test setup. If tests need these modules registered, the test fixture should do it. These shims should be deleted.

---

### 🔥 `loadCountries.js` mutates the `runtime` parameter directly

```js
runtime.worldMapInst = worldMapInst;
```

A function receives an object as a parameter and then mutates it. This is a side-effect on a caller's object, not a return value. The caller (`bootstrap.js`) built `runtime` and passed it in. Now `loadCountries.js` is secretly reaching back into it and modifying it. If you want to return the globe instance, return it. Don't mutate parameters.

---

### 🔥 `loadCountries.js` uses D3 to make a `fetch()` call

```js
const data = runtime.d3?.json
  ? await runtime.d3.json(url)
  : await fetch(url).then((r) => r.json());
```

The fallback path is correct. The primary path is calling `d3.json()` — a thin wrapper around `fetch()` — because the runtime might have `d3` on it. `d3.json()` has been deprecated and removed in modern D3 versions. More importantly, there is no reason for a JSON fetch to go through D3 at all. The fallback line is the right code. Delete the D3 path, delete the ternary, and call `fetch()` directly. STATUS.md even identified this as unnecessary — it remains unfixed.

---

### 🔥 `tests/README.md` still says 91 tests

The first review didn't call this out directly, but the STATUS.md has been noting it as Medium severity tech debt since at least the last audit. The file claims:

> *"Total Tests: 91 • Coverage Target: >70%"*

There are **337 tests**. That is almost four times the documented count. The test count is in the title line, the summary table, and repeated in the footer. Every line of it is wrong. This is not a nit — it is the primary documentation for the test suite and it is comprehensively stale. Fix it or delete it.

---

### 🔥 The four accessor wrappers in `control.js` exist for no reason

```js
const getDom = () => getRuntime().dom ?? {};
const getState = () => getRuntime().state ?? {};
const getConfig = () => getRuntime().config ?? {};
const getActions = () => getRuntime().actions ?? {};
```

These are module-level arrow functions. Every time a function in `control.js` needs the dom, it calls `getDom()`, which calls `getRuntime()`, which either returns `_runtime` or falls back to `window.worldleLiteRuntime`. This gives you two layers of indirection, four function definitions, and the illusion of encapsulation. The `?? {}` fallback returns an empty object on failure, which means property reads silently return `undefined` instead of throwing, which means bugs become invisible.

If the runtime isn't set up, you want to know immediately. The throw in `getRuntime()` exists for exactly this purpose and the `?? {}` fallback defeats it. Call `getRuntime().dom` directly.

---

### 🔴 `debug.js` indentation is still broken

This was in the first review. It is item #7 in the STATUS.md tech debt table. Nothing has changed. The file is still indented two extra spaces at the module level as if an outer wrapper was removed without re-indenting. It is a cosmetic issue and it has been sitting there unfixed long enough to get its own entry in two separate code reviews.

---

### 🔴 `query.js` has a module-level cache that is correct by accident

```js
let _cachedGroupsState = null;
let _cachedGroups = null;
```

The memoization key is the `state` object reference. This works as long as a new state object is produced on every store update — which it is, because the reducer returns new objects. But this is implicit. Nothing in `query.js` enforces or documents the assumption that `state` is an immutable value object. If the store ever starts mutating state in place (which the `window._gameStore` era made plausible), this cache will silently serve stale data forever. The assumption should be documented explicitly, or the cache should validate what it actually needs to validate.

---

### Summary

The first review asked you to fix the `window` globals architecture, clean up the double-call patterns, and update the documentation. The `window._gameStore` bus is gone — that was real progress. But the underlying impulse — *let's just read from the window instead of importing things properly* — has leaked into `debug.js`'s private `getRuntime()`, into the self-registration shims in `ui.js` and `input.js`, and into `constants.js`'s backward-compat global. The pattern was evicted through the front door and came back through three windows.

The most serious new issues are the module-level mutable state in `control.js` that survives "New Game" and the parameter mutation in `loadCountries.js`. Those are bugs, not style. Fix those first.

---

## Action Items

- [ ] **`control.js` — `solvedCountriesByRegion` and `celebratedRegions`** — Move to store state or add an explicit reset call at the start of a new game. These surviving "New Game" is a real bug.
- [ ] **`debug.js` — private `getRuntime()`** — Delete it. Import `getRuntime` from `'../runtime.js'` like every other module.
- [ ] **`bindings.js` — double `syncDebugToggleUi` call** — Remove the `window.worldleLiteDebug?.syncDebugToggleUi?.()` call. Keep only the direct import.
- [ ] **`globe.js` — `FALLBACK_COUNTRY_COLORS` / `FALLBACK_GLOBE_BACKGROUND`** — Import from `src/constants.js` directly. Delete the duplicates. Delete the `window.gameConstants` read. Remove the `window.gameConstants = gameConstants` shim from `constants.js` once `globe.js` no longer needs it.
- [ ] **`ui.js` and `input.js` — top-level self-registration shims** — Delete the `window.worldleLiteRuntime.roundUi = ...` and `window.worldleLiteRuntime.input = ...` blocks. `bootstrap.js` already wires these correctly. If tests need them, fix the test fixtures.
- [ ] **`loadCountries.js` — parameter mutation** — Return `worldMapInst` from the function instead of writing it onto the `runtime` parameter. Let the caller assign it.
- [ ] **`loadCountries.js` — `runtime.d3?.json`** — Delete the D3 path. Call `fetch(url).then(r => r.json())` unconditionally.
- [ ] **`control.js` — `getDom/getState/getConfig/getActions` wrappers** — Remove the `?? {}` fallback so runtime errors surface properly. Consider removing the wrappers entirely.
- [ ] **`globe.js` — opening comment** — Remove or rewrite "deliberately simple and maintainable" until the file actually is.
- [ ] **`tests/README.md`** — Update the test count (337, not 91), update coverage numbers, remove false "✅ Complete" claims.
- [ ] **`debug.js` indentation** — Fix the spurious two-space indent on all module-level functions. This has been on the list since the first review.
