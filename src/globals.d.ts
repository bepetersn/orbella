/**
 * Ambient type declarations for runtime globals that are loaded via vendor
 * scripts or set up by side-effect imports (e.g. src/constants.js,
 * src/config.js) before the ES-module graph fully initialises.
 *
 * These declarations silence editor errors for known-good globals while
 * keeping `checkJs: true` useful for real mistakes.
 */

// Globe.gl constructor – loaded from src/vendor/globe.gl.min.js
declare const Globe: any;

interface Window {
  // Set by src/constants.js – country colour palette and globe background
  gameConstants?: {
    COUNTRY_COLORS?: {
      light: Record<string, string>;
      dark: Record<string, string>;
    };
    GLOBE_BACKGROUND?: { light: string; dark: string };
    [key: string]: unknown;
  };

  // Set by src/config.js
  gameConfig?: {
    COUNTRY_EXCLUDED_POLYGON_BOUNDS?: Map<string, unknown>;
    DEBUG?: boolean;
    [key: string]: unknown;
  };

  // Debug flag toggled at runtime
  __WORLDLE_DEBUG__?: boolean;

  // Diagnostics exposed by globe.js for console inspection
  worldleLiteGeoStats?: unknown;
  globeLibInfo?: {
    scriptSrc: string | null;
    version: string;
    [key: string]: unknown;
  };

  // Longitude-flip helpers exposed on window for console debugging
  worldleFlipLon?: boolean;
  setLonFlip?: (enable: boolean) => void;
  toggleLonFlip?: () => void;
  setLonNormalize?: (enable: boolean) => void;
  toggleLonNormalize?: () => void;

  // Exposed by globe.js for runtime testing
  toggleAntarcticaDisplay?: (show: boolean) => void;

  // Other runtime globals set by side-effect imports
  worldMap?: unknown;
  worldMapInst?: unknown;
  audioFeedback?: unknown;
  themeSystem?: unknown;
  worldleLiteSettings?: unknown;
  targetSelector?: unknown;
  gameStore?: unknown;
  worldleLiteRuntime?: unknown;
  worldleLiteDebug?: {
    bindDebugToggle?: () => void;
    [key: string]: unknown;
  };
  _gameStore?: Record<string, unknown>;
}
