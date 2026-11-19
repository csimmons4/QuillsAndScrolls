// `npm run test:sweep`: the slow, broad sweeps in src/test/sweeps (every class and subclass, every
// button, every potion…). Kept out of `npm test`, which only picks up *.test.ts(x).
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    include: ['src/test/sweeps/**/*.sweep.tsx'],
    testTimeout: 30 * 60 * 1000,
  },
}))
