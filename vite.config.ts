import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['manifest-icon-192.svg', 'manifest-icon-512.svg'],
      manifest: {
        name: 'Lingua - Language Learning',
        short_name: 'Lingua',
        description: 'AI-powered vocabulary learning with 21 integrated tools',
        theme_color: '#2563EB',
        background_color: '#0F172A',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'manifest-icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'manifest-icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^http:\/\/localhost:8420\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: { port: 5174 },
})
