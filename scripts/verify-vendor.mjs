/**
 * verify-vendor.mjs
 *
 * Verifies that the files in src/vendor/ are byte-for-byte identical to the
 * corresponding dist files from the npm-installed packages declared in
 * package.json.  Exits non-zero with a clear error if anything is out of sync.
 *
 * Run automatically via the `predev` and `prebuild` lifecycle hooks.
 * Run manually with:  npm run vendor:verify
 *
 * To fix a mismatch, run:  npm run vendor:update
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

/**
 * Each entry maps:
 *   vendoredPath  – path of the file checked into src/vendor/
 *   npmPackage    – npm package name (must be in package.json devDependencies)
 *   distPath      – path inside node_modules/<package>/ to the canonical dist file
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

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

let failed = false;

for (const { vendoredPath, npmPackage, distPath } of VENDOR_MAP) {
  const vendoredAbs = resolve(root, vendoredPath);
  const distAbs = resolve(root, distPath);

  let vendoredHash, distHash;

  try {
    vendoredHash = sha256(vendoredAbs);
  } catch {
    console.error(`[vendor:verify] MISSING vendored file: ${vendoredPath}`);
    console.error(`  Fix: run \`npm run vendor:update\``);
    failed = true;
    continue;
  }

  try {
    distHash = sha256(distAbs);
  } catch {
    console.error(`[vendor:verify] MISSING npm dist for '${npmPackage}': ${distPath}`);
    console.error(`  Fix: run \`npm install\``);
    failed = true;
    continue;
  }

  if (vendoredHash !== distHash) {
    // Read the declared version from package.json for a helpful error message
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    const declaredVersion =
      (pkg.devDependencies || {})[npmPackage] ||
      (pkg.dependencies || {})[npmPackage] ||
      '(not declared)';

    console.error(`[vendor:verify] MISMATCH: ${vendoredPath}`);
    console.error(`  package.json declares: ${npmPackage}@${declaredVersion}`);
    console.error(`  npm dist hash  : ${distHash}`);
    console.error(`  vendored hash  : ${vendoredHash}`);
    console.error(`  The vendored file does not match the installed npm package.`);
    console.error(`  Fix: run \`npm run vendor:update\` to sync src/vendor/ from node_modules,`);
    console.error(`       or update the version in package.json then \`npm install && npm run vendor:update\`.`);
    failed = true;
  } else {
    console.log(`[vendor:verify] OK  ${vendoredPath}  (${npmPackage}@${
      JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).devDependencies[npmPackage]
    })`);
  }
}

if (failed) {
  process.exit(1);
}
