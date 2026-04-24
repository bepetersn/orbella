/**
 * @fileoverview Light/dark theme persistence and toggle behaviour.
 *
 * Resolves the active theme from `localStorage` (falling back to the OS
 * `prefers-color-scheme` media query), applies it to the document root, and
 * wires the toggle button so clicking it cycles between `"light"` and
 * `"dark"`.
 *
 * Exported as {@link window.themeSystem}.
 */
(() => {
  const { COPY, THEME_STORAGE_KEY } = window.gameConfig;
  let themeToggleElement = null;

  /**
   * Return `"dark"` or `"light"` by reading `localStorage`, falling back to
   * the OS `prefers-color-scheme` media query when no stored preference exists.
   * @returns {"dark" | "light"}
   */
  function getInitialTheme() {
    try {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme === "light" || storedTheme === "dark") {
        return storedTheme;
      }
    } catch {
      // Ignore storage access failures and fall back to system preference.
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  /**
   * Update the toggle button's text content and ARIA attributes to reflect
   * `theme`.  Does nothing when no button element has been registered.
   * @param {"dark" | "light"} theme
   */
  function syncThemeToggle(theme) {
    if (!themeToggleElement) {
      return;
    }

    const isDark = theme === "dark";
    themeToggleElement.textContent = isDark ? COPY.themeToggle.lightText : COPY.themeToggle.darkText;
    themeToggleElement.setAttribute("aria-label", isDark ? COPY.themeToggle.lightAriaLabel : COPY.themeToggle.darkAriaLabel);
    themeToggleElement.setAttribute("aria-pressed", String(isDark));
  }

  /**
   * Set `document.documentElement.dataset.theme` to `theme` and sync the
   * toggle button's text and ARIA attributes via {@link syncThemeToggle}.
   * @param {"dark" | "light"} theme
   */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    syncThemeToggle(theme);
  }

  /**
   * Flip the active theme between `"dark"` and `"light"`, persist the new
   * value to `localStorage`, and apply it to the document and toggle button.
   */
  function toggleTheme() {
    const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage failures; the theme still updates for this session.
    }

    applyTheme(nextTheme);
  }

  /**
   * Store a reference to `themeToggleElementArg`, apply the initial theme, and
   * attach the click listener that calls {@link toggleTheme}.
   * Safe to call with `null` when no toggle button is present.
   * @param {HTMLElement | null} themeToggleElementArg
   */
  function initializeTheme(themeToggleElementArg) {
    themeToggleElement = themeToggleElementArg || null;
    applyTheme(getInitialTheme());

    if (themeToggleElement) {
      themeToggleElement.addEventListener("click", toggleTheme);
    }
  }

  window.themeSystem = {
    getInitialTheme,
    applyTheme,
    toggleTheme,
    initializeTheme
  };
})();
