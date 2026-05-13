# Code Review: `worldle-lite`

*— Your Angry TL*

---

### 🔥 The README is a bold-faced lie

> *"The app is intentionally static: no bundler, no build step, and no package install is required."*

There is a `package.json`. There is a `vite.config.js`. There is a `vitest.config.js`. There is a `.venv`. There is a `pipeline/` directory with build scripts. **FIX YOUR README BEFORE I LOSE MY MIND.**

---

### 🔥 `window._gameStore` is not a module system

`store/constants.js` seeds `window._gameStore = window._gameStore || {}`, then every single store module reads from it and writes to it at import time, and then `store/index.js` wraps it all back up into an export. You are using the `window` object as a makeshift module registry **inside an ES module project with a bundler**. You have literally invented a worse version of `import`. I would have more respect for a single god-object.

And there's even a comment in `store/constants.js` admitting it:

> *"Remove when store/index.js is refactored to import these directly."*

That was written in the past tense of regret. When is "when"? Today is when.

---

### 🔥 `main.js`: side-effect import order as load-bearing architecture

> *"Import order must match the previous HTML script-tag sequence exactly."*

Every import in `main.js` is a side-effect import, in a specific order that must be preserved, because everything is mutating `window` globals. This is `<script>` tags with extra steps. You have a bundler. Use it. Export things. Import them. That's the deal.

---

### 🔥 Two `vite.config.js` files

`/vite.config.js` and `/src/vite.config.js`. Which one actually runs? Nobody knows. Pick one. Delete the other.

---

### 🔥 `debug.js` is indented for no reason

Every function in `src/app/debug.js` is indented two spaces inside the module scope like it was copy-pasted out of a class or object literal and nobody noticed. It looks like a file that had its outer wrapper removed at 2am and then shipped.

---

### 🔥 `bootstrap.js` calls the debug toggle twice

```js
window.worldleLiteDebug?.bindDebugToggle?.();
bindDebugToggle();
```

Two lines. Back to back. `bindDebugToggle` — once through the global, once directly. This is what defensive copy-paste archaeology looks like. One of these is wrong. Figure out which one.

---

### 🔥 The `config.test.js` tests a `mockGameConfig`, not `gameConfig`

The test file imports `gameConfig` and then never uses it. It creates a hardcoded `mockGameConfig` object and asserts that the hardcoded values are what they are. This is a test that tests nothing. It will never fail regardless of what you do to the actual config. Delete it or fix it.

---

### 🔥 `input.test.js.bak` is committed to the repository

`tests/unit/app/input.test.js.bak` is a backup file. In version control. A system specifically designed so you never need backup files. Remove it.

---

### 🔥 The architecture diagram references `src/map/worldMap.js`

`diagrams/architecture.mmd`: `MAP[src/map/worldMap.js]`. That file does not exist. The actual module is `src/map/globe.js`. Your documentation is wrong and has apparently been wrong long enough for the whole globe module to be renamed without anyone updating the diagram.

---

### 🔥 `runtime.js` uses `window` as a backing store to survive `vi.resetModules()`

> *"Uses window as the backing store so the reference survives vi.resetModules() in tests"*

If your test architecture forces you to persist module state on `window` because the module system keeps resetting it, your test architecture is the problem. This is a smell that has been welded to the wall.

---

### 🔥 `bootstrap.js` has an IIFE where a function should be

```js
const runtime = _rt.actions ? _rt : (() => {
  ...
  return { ... };
})();
```

This is `buildRuntime()` wanting to be a function with a name. Give it one.

---

### Summary

The bones of this project are fine — the store reducer is clean, the round lifecycle is decomposed reasonably, there's real test coverage. But the **glue layer is held together with `window` globals, side-effect imports, and copy-paste archaeology.** The modules do not trust each other enough to import from each other directly. Fix the `window._gameStore` bus, fix the import architecture, and update the README to reflect the world as it actually is.

---

## Action Items

- [ ] **README.md** — Rewrite the "Structure" section to accurately describe the Vite-based build setup; remove the claim that no bundler/build step is required.
- [ ] **`src/store/constants.js` + all store modules** — Remove the `window._gameStore` bus. Refactor store modules to import from each other directly using ES `import`; let `store/index.js` assemble the public API from named imports.
- [ ] **`src/main.js`** — Replace side-effect-only imports with real named imports/exports now that the `window._gameStore` bus is gone; document (or eliminate) any remaining required ordering.
- [ ] **Duplicate `vite.config.js`** — Determine which of `/vite.config.js` and `/src/vite.config.js` is actually used and delete the other.
- [ ] **`src/app/debug.js`** — Fix the spurious two-space indentation on all module-level functions.
- [ ] **`src/app/bootstrap.js` — double `bindDebugToggle` call** — Remove the redundant `window.worldleLiteDebug?.bindDebugToggle?.()` call (or the direct one) and keep only the correct path.
- [ ] **`tests/unit/config.test.js`** — Rewrite tests to assert against the real imported `gameConfig` values instead of a hardcoded `mockGameConfig` shadow object.
- [ ] **`tests/unit/app/input.test.js.bak`** — Delete this file from the repository.
- [ ] **`diagrams/architecture.mmd`** — Update `MAP` node reference from `src/map/worldMap.js` to `src/map/globe.js` (and audit the rest of the diagram for other stale references).
- [ ] **`src/app/runtime.js`** — Investigate replacing the `window`-backed runtime singleton with a proper module-level singleton that doesn't need to survive `vi.resetModules()`, or restructure tests so `resetModules()` is not needed.
- [ ] **`src/app/bootstrap.js` — anonymous IIFE** — Extract the inline IIFE that builds the runtime object into a named function (e.g. `buildRuntimeFromDeps()`).
