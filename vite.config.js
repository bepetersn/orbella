import { defineConfig } from 'vite';
import { resolve } from 'path';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

let buildId;
try {
  buildId = execSync('git describe --tags --always --dirty 2>/dev/null').toString().trim();
  if (!buildId) throw new Error('empty output');
} catch {
  buildId = new Date().toISOString().slice(0, 10);
}

// Compute a short content hash of the GeoJSON data file so the browser
// re-fetches only when the data actually changes — not on every build.
const GEOJSON_PATH = resolve(__dirname, 'pipeline/data/generated/world-countries.render.json');
let geoJsonHash;
try {
  const content = readFileSync(GEOJSON_PATH);
  geoJsonHash = createHash('sha256').update(content).digest('hex').slice(0, 12);
} catch {
  // File not present (e.g. pipeline hasn't run yet). Fall back to BUILD_ID so
  // the app still gets a cache-bust token, and the missing file will surface as
  // a runtime fetch error rather than a silent stale-cache hit.
  geoJsonHash = buildId;
}

export default defineConfig({
  // Base path for GitHub Pages. Set the env var `GH_PAGES_BASE` to
  // "/your-repo-name/" when publishing to a project page. Defaults to
  // root (`/`) which is suitable for user/org pages or a custom domain.
  // Default to the project-page base for `orbella`. Users can override
  // this at publish time by setting the `GH_PAGES_BASE` environment
  // variable (e.g. `GH_PAGES_BASE=/orbella/`).
  base: process.env.GH_PAGES_BASE || '/orbella/',
  root: '.',
  build: {
    // Output directly to `public/` so GitHub Pages can serve from the
    // repository's `public/` folder. This is equivalent to `docs/` for
    // Pages but avoids the overloaded `docs` name. If you prefer a
    // `gh-pages` branch, leave this as `dist` and publish the branch
    // instead.
    outDir: 'public',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'worldle-lite.html'),
      },
      output: {
        // Bundle all JS into a single main bundle
        manualChunks: undefined,
      },
    },
    // Use esbuild for minification (built-in, no extra dependency)
    minify: 'esbuild',
  },
  server: {
    // Development server config
    open: 'worldle-lite.html',
  },
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
    __GEOJSON_HASH__: JSON.stringify(geoJsonHash),
  },
});
