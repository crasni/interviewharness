import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

// Workspace packages ship TypeScript source, so bundle them instead of externalizing. pi-ai is a
// dependency of providers only, so the app can't load it by name at run time: bundle it too (only the
// provider SDKs we register end up in the app).
const bundleWorkspace = {
  exclude: ['@interviewharness/core', '@interviewharness/engine', '@interviewharness/providers', '@earendil-works/pi-ai'],
};

export default defineConfig({
  main: {
    build: { externalizeDeps: bundleWorkspace },
  },
  preload: {
    build: {
      externalizeDeps: bundleWorkspace,
      // Sandboxed preloads must be CommonJS.
      rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } },
    },
  },
  renderer: {
    plugins: [react()],
  },
});
