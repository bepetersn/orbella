/**
 * Stamps the BUILD_ID constant in src/app/runtime.js with the current git
 * description (e.g. "v1.2.0-3-gabcdef" or "abcdef7-dirty"), falling back to
 * today's ISO date if git is unavailable.
 *
 * Run via: npm run stamp
 * Runs automatically as a prebuild hook before: npm run build
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

let id;
try {
  id = execSync('git describe --tags --always --dirty 2>/dev/null').toString().trim();
  if (!id) throw new Error('empty output');
} catch {
  id = new Date().toISOString().slice(0, 10);
}

const filePath = 'src/app/runtime.js';
const original = readFileSync(filePath, 'utf8');
const updated = original.replace(
  /const BUILD_ID = "[^"]*"/,
  `const BUILD_ID = "${id}"`
);

if (updated === original) {
  console.warn('stamp-build-id: BUILD_ID pattern not found in', filePath);
  process.exit(1);
}

writeFileSync(filePath, updated);
console.log(`stamp-build-id: BUILD_ID set to "${id}" in ${filePath}`);
