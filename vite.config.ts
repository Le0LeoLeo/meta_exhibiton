import { configDefaults, defineConfig } from 'vitest/config'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { getManualChunk } from './config/manualChunks'
import { createDevProxyOptions } from './config/devProxy'
import { homePrerender } from './config/homePrerender'

const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:5176'
const wsTarget = process.env.VITE_WS_PROXY_TARGET || 'http://localhost:3001'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    homePrerender(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        ...createDevProxyOptions(apiTarget),
      },
      '/socket.io': {
        target: wsTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**', '**/.tmp/**'],
    // Keep browser/SQLite suites predictable on developer laptops and small CI runners.
    maxWorkers: 2,
    testTimeout: 15_000,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
  build: {
    // Three.js ships its WebGL runtime as one cacheable module; the enforced
    // 800 KiB bundle gate below remains the hard regression limit.
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks: getManualChunk,
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
