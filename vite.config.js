import { defineConfig } from 'vite';
import { resolve } from 'path';
import { execSync } from 'child_process';

let buildId;
try {
  buildId = execSync('git describe --tags --always --dirty 2>/dev/null').toString().trim();
  if (!buildId) throw new Error('empty output');
} catch {
  buildId = new Date().toISOString().slice(0, 10);
}

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
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
  },
});
