import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Phones and tablets on your Wi-Fi: only when switched on in Settings (kept in .local-settings.json,
// read once at start-up). Otherwise the app listens on this computer alone.
const dataDir = process.env.QS_DATA_DIR ? path.resolve(process.env.QS_DATA_DIR) : __dirname
const lan = (() => {
  try { return !!JSON.parse(fs.readFileSync(path.join(dataDir, '.local-settings.json'), 'utf8')).lan } catch { return false }
})()

export default defineConfig({
  plugins: [react()],
  // Lets Settings tell whether the running app was started with network access
  define: { __QS_LAN__: JSON.stringify(lan) },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: lan ? true : undefined,
    proxy: {
      '/api': `http://127.0.0.1:${process.env.QS_API_PORT ?? 5174}`,
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
