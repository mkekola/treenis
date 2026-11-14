/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']

export default defineConfig(({ command, mode }) => {
  // Ilman näitä sovellus kaatuu käynnistyessään mustaksi ruuduksi. Build pysähtyy
  // mieluummin, jolloin julkaisuun jää edellinen toimiva versio.
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const missing = REQUIRED_ENV.filter((key) => !env[key])
    if (missing.length) throw new Error(`Puuttuvat ympäristömuuttujat: ${missing.join(', ')}`)
  }

  return {
    plugins: [
      vue(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // Fontit mukaan, jotta ne toimivat salilla myös ilman verkkoa.
        workbox: { globPatterns: ['**/*.{js,css,html,woff2}'] },
        manifest: {
          name: 'Treenis',
          short_name: 'Treenis',
          description: 'Treenipäiväkirja salille ja lenkeille',
          lang: 'fi',
          start_url: '/',
          display: 'standalone',
          background_color: '#FFFFFF',
          theme_color: '#FFFFFF',
          icons: [
            { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      // Testit kattavat puhtaan logiikan, joten selainympäristöä ei tarvita.
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
