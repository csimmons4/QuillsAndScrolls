import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Phones and tablets on your Wi-Fi, in development (`npm run dev`): only when switched on in Settings
// (kept in .local-settings.json, read once at start-up). `npm start` serves the app through server.ts,
// which reads the same setting.
const dataDir = process.env.QS_DATA_DIR ? path.resolve(process.env.QS_DATA_DIR) : import.meta.dirname
const lan = (() => {
  try { return !!JSON.parse(fs.readFileSync(path.join(dataDir, '.local-settings.json'), 'utf8')).lan } catch { return false }
})()

// Shown in Settings
const appVersion = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'package.json'), 'utf8')).version

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    host: lan ? true : undefined,
    proxy: {
      '/api': `http://127.0.0.1:${process.env.QS_API_PORT ?? 5174}`,
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Libraries and the curated game data change rarely: separate files the browser can keep
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'zod', test: /node_modules[\\/]zod[\\/]/ },
            { name: 'game-data', test: /[\\/]src[\\/]data[\\/]/ },
          ],
        },
      },
    },
  },
})
