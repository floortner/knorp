/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
import { execSync } from 'node:child_process';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import pkg from './package.json';

// Build stamp shown in the Profil tab (ARCHITECTURE §7; mirrors backend /health version+commit).
// Deploy sets GIT_COMMIT; local builds fall back to the working tree's HEAD, then 'dev'.
const commit = (() => {
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
})();

// Internal staff portal: a plain static SPA (no PWA — staff are online on desktop/tablet, never offline
// mid-lesson like the family app). Desktop/tablet, landscape (ARCHITECTURE §1a/§11).
export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(`${pkg.version}+${commit}`),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // 5174 is the trainer's documented port; strictPort so a bare `npm run dev` can never silently
  // grab 5173 (the family app's port) when it's free, or shift away when it's not.
  server: { port: 5174, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
