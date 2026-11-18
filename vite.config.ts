import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Name hier und in src/config/app.ts ändern, falls die App umbenannt wird.
const APP_NAME = 'Social Publy';

export default defineConfig({
  // Relative Pfade: funktioniert unter name.github.io/social-publy/ ebenso wie lokal
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-32.png'],
      manifest: {
        name: `${APP_NAME} – Dein Bar- & Club-Tagebuch`,
        short_name: APP_NAME,
        description: 'Halte fest, in welchen Bars und Clubs du warst, bewerte sie und sieh, wo deine Freunde unterwegs sind.',
        lang: 'de',
        theme_color: '#0f0d16',
        background_color: '#0f0d16',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{js,css,html,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[abc]?\.?tile\.openstreetmap\.org\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'osm-tiles', expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          }
        ]
      }
    })
  ]
});
