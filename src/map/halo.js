import * as animations from './animations.js';

// Small adapter that prefers a 3D globe halo manager but falls back to the
// (deprecated) SVG animation hook when available. Keeps a stable API for
// callers that want to show a halo without caring about renderer details.
export const createHaloAdapter = (haloMgr, svgCtx) => ({
  showLocationHalo(country, opts = {}) {
    if (haloMgr && typeof haloMgr.showHaloForCountry === 'function') {
      try {
        haloMgr.showHaloForCountry(country, opts);
        return;
      } catch (e) {
        /* ignore and try fallback */
      }
    }

    if (svgCtx && typeof animations.showLocationHalo === 'function') {
      try {
        animations.showLocationHalo(svgCtx, country);
        return;
      } catch (e) {
        /* ignore fallback errors */
      }
    }

    try {
      if (console && console.warn) console.warn('[halo] no halo implementation available');
    } catch (e) {
      /* ignore */
    }
  },
});

export default createHaloAdapter;
