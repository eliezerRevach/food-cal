/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/food-cal/' : '/',
  server: {
    proxy: {
      // Same-origin requests from the Vite dev server avoid browser CORS/mixed-origin issues.
      '/log-meal': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/log-meal-manual': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/get-daily-summary': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/entries': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/entries-rollups': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/food-suggest': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/backup': { target: 'http://127.0.0.1:8000', changeOrigin: true },
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
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
