import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath, URL } from 'node:url';

// Relative base so the build works on GitHub Pages sub-paths and static hosts alike.
export default defineConfig({
  base: './',
  plugins: [preact()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      // three.js changes rarely: keep it in its own long-cached chunk
      output: { manualChunks: { three: ['three'] } },
    },
  },
  server: { host: true, port: 5173 },
});
