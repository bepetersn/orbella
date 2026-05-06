/**
 * update-vendor.mjs
 *
 * The ONLY blessed way to update files in src/vendor/.
 *
 * Copies the canonical dist files from node_modules into src/vendor/,
 * using the versions declared in package.json as the source of truth.
 *
 * Usage:
 *   npm run vendor:update
 *
 * Typical workflow for updating a vendored dependency:
 *   1. Update the version in package.json  (no ^ or ~ — use exact versions)
 *   2. npm install
 *   3. npm run vendor:update
 *   4. Commit both package.json, package-lock.json, and the updated src/vendor/ file
 */

import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

/**
 * Same mapping as verify-vendor.mjs — keep these two files in sync.
 */
const VENDOR_MAP = [
  {
    vendoredPath: 'src/vendor/d3.v7.min.js',
    npmPackage: 'd3',
    distPath: 'node_modules/d3/dist/d3.min.js',
  },
  {
    vendoredPath: 'src/vendor/globe.gl.min.js',
    npmPackage: 'globe.gl',
    distPath: 'node_modules/globe.gl/dist/globe.gl.min.js',
  },
];

mkdirSync(resolve(root, 'src/vendor'), { recursive: true });

for (const { vendoredPath, npmPackage, distPath } of VENDOR_MAP) {
  const src = resolve(root, distPath);
  const dest = resolve(root, vendoredPath);
  try {
    copyFileSync(src, dest);
    console.log(`[vendor:update] Copied  ${distPath}  →  ${vendoredPath}  (${npmPackage})`);
  } catch (err) {
    console.error(`[vendor:update] FAILED to copy ${npmPackage}: ${err.message}`);
    console.error(`  Is '${npmPackage}' installed?  Try: npm install`);
    process.exit(1);
  }
}

console.log('[vendor:update] Done. Commit the updated src/vendor/ files.');
