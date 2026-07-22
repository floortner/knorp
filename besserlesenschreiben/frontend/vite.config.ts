/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// PWA: prompt-to-update (never silent reload mid-lesson — ARCHITECTURE / CLAUDE.md).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      workbox: {
        navigateFallback: 'index.html',
        // Read-mostly API data: serve from network, fall back to the last good response after a short
        // timeout so a connectivity blip doesn't blank /lernen or /profil (ARCHITECTURE — offline-playable).
        // Writes (POST /attempts etc.) are never cached; the telemetry queue handles their retry.
        // NOTE: `/me` is deliberately NOT cached — it's the auth probe, and a cached 200 would let a
        // logged-out user reload offline back into the previous session (security review P2-1).
        runtimeCaching: [
          {
            urlPattern: ({ url, request }: { url: URL; request: Request }) =>
              request.method === 'GET' && /\/api\/v1\/(units|progress)(\/|$|\?)/.test(url.pathname + url.search),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'blsb-api',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 }, // 1 day
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      manifest: {
        name: 'besserlesenschreiben',
        short_name: 'blesen',
        description: 'Adaptive German literacy tutor for students (ages 8–14)',
        theme_color: '#27A99B',
        background_color: '#FCF7EF',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
