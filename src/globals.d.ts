/**
 * Ambient type declarations for runtime globals that remain intentionally
 * exposed for debugging or runtime wiring.
 *
 * These declarations silence editor errors for known-good globals while
 * keeping `checkJs: true` useful for real mistakes.
 */

interface Window {
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

  worldleLiteRuntime?: unknown;
  worldleLiteDebug?: {
    bindDebugToggle?: () => void;
    [key: string]: unknown;
  };
}
