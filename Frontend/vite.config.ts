import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Kotoba - Japanese SRS Learning',
        short_name: 'Kotoba',
        description: 'Master Japanese Radicals, Kanji, and Vocabulary through Spaced Repetition',
        theme_color: '#090d16',
        background_color: '#090d16',
        display: 'standalone',
        icons: [
          {
            src: '/vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5277',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
