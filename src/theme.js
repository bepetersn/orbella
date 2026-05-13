/**
 * @fileoverview Light/dark theme persistence and toggle behaviour.
 *
 * Resolves the active theme from `localStorage` (falling back to the OS
 * `prefers-color-scheme` media query), applies it to the document root, and
 * wires the toggle checkbox so changing it cycles between `"light"` and
 * `"dark"`.
 *
 * Exported as {@link window.themeSystem}.
 */
import { gameConfig } from './config.js';

const { COPY, THEME_STORAGE_KEY } = gameConfig;
let themeToggleElement = null;
let _getGlobe = () => null;

/**
 * Return `"dark"` or `"light"` by reading `localStorage`, falling back to
 * the OS `prefers-color-scheme` media query when no stored preference exists.
 * @returns {"dark" | "light"}
 */
export function getInitialTheme() {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }
  } catch {
    // Ignore storage access failures and fall back to system preference.
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Update the toggle checkbox's checked state to reflect `theme`.
 * Does nothing when no checkbox element has been registered.
 * @param {"dark" | "light"} theme
 */
function syncThemeToggle(theme) {
  if (!themeToggleElement) {
    return;
  }

  const isDark = theme === 'dark';
  themeToggleElement.checked = isDark;
}

/**
 * Set `document.documentElement.dataset.theme` to `theme` and sync the
 * toggle checkbox's state via {@link syncThemeToggle}.
 * @param {"dark" | "light"} theme
 */
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  syncThemeToggle(theme);
}

/**
 * Update the globe texture and colors when theme changes.
 * @param {"dark" | "light"} theme
 */
function updateGlobeTexture(theme) {
  try {
    const globe = _getGlobe();
    if (globe && typeof globe.globeImageUrl === 'function') {
      const globeImg = theme === 'dark' ? 'img/earth-dark.jpg' : 'img/earth-light.jpg';
      globe.globeImageUrl(globeImg);

      // Update the canvas background color for the new theme
      try {
        const backgrounds = window.gameConstants?.GLOBE_BACKGROUND;
        if (backgrounds && typeof globe.backgroundColor === 'function') {
          globe.backgroundColor(backgrounds[theme] || backgrounds.light);
        }
      } catch (e) {
        // Ignore if backgroundColor isn't available
      }

      // Force polygon colors to update by re-setting the data
      // This triggers the color callbacks with the new theme colors
      try {
        const currentData = typeof globe.polygonsData === 'function' ? globe.polygonsData() : null;
        if (currentData) {
          globe.polygonsData(currentData);
        }
      } catch (e) {
        // Ignore if polygonsData isn't available
      }
    }
  } catch (e) {
    // Ignore globe update failures; the theme CSS still updates
  }
}

/**
 * Flip the active theme between `"dark"` and `"light"`, persist the new
 * value to `localStorage`, and apply it to the document and toggle checkbox.
 */
export function toggleTheme() {
  const currentTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // Ignore storage failures; the theme still updates for this session.
  }

  applyTheme(nextTheme);
  updateGlobeTexture(nextTheme);
}

/**
 * Store a reference to `themeToggleElementArg`, apply the initial theme, and
 * attach the change listener that calls {@link toggleTheme}.
 * Safe to call with `null` when no toggle checkbox is present.
 * @param {HTMLElement | null} themeToggleElementArg
 */
export function initializeTheme(themeToggleElementArg, { getGlobe = () => null } = {}) {
  themeToggleElement = themeToggleElementArg || null;
  _getGlobe = getGlobe;
  applyTheme(getInitialTheme());

  if (themeToggleElement) {
    themeToggleElement.addEventListener('change', toggleTheme);
  }
}

// Backward-compat shim — remove once all callers use import
window.themeSystem = {
  getInitialTheme,
  applyTheme,
  toggleTheme,
  initializeTheme,
};
