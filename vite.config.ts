import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:5174',
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Libraries and the curated game data change rarely: separate files the browser can keep
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router') || id.includes('node_modules/scheduler')) return 'react'
          if (id.includes('node_modules/zod')) return 'zod'
          if (id.includes('/src/data/')) return 'game-data'
        },
      },
    },
  },
})
