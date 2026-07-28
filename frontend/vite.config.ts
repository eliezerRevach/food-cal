/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// VITE_BASE=/food-cal/ for GitHub Pages project site; omit (or /) for local dev.
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  server: {
    proxy: {
      // Same-origin requests from the Vite dev server avoid browser CORS/mixed-origin issues.
      '/log-meal': { target: 'http://127.0.0.1:8002', changeOrigin: true },
      '/log-meal-manual': { target: 'http://127.0.0.1:8002', changeOrigin: true },
      '/get-daily-summary': { target: 'http://127.0.0.1:8002', changeOrigin: true },
      '/entries': { target: 'http://127.0.0.1:8002', changeOrigin: true },
      '/entries-rollups': { target: 'http://127.0.0.1:8002', changeOrigin: true },
      '/food-suggest': { target: 'http://127.0.0.1:8002', changeOrigin: true },
      '/history-food-suggest': { target: 'http://127.0.0.1:8002', changeOrigin: true },
      '/manual-presets': { target: 'http://127.0.0.1:8002', changeOrigin: true },
      '/backup': { target: 'http://127.0.0.1:8002', changeOrigin: true },
      '/recipes': { target: 'http://127.0.0.1:8002', changeOrigin: true },
      '/log-recipe': { target: 'http://127.0.0.1:8002', changeOrigin: true },
      '/parse-ingredient': { target: 'http://127.0.0.1:8002', changeOrigin: true },
    },
  },
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
