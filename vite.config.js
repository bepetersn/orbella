import { defineConfig } from 'vite';
import { resolve } from 'path';

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
});
