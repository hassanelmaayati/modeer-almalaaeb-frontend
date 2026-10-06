import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { UnitCompletionReporter, validateManifest } from '../scripts/offline-runner.mjs'

const manifest = validateManifest()

export default defineConfig({
  envDir: false,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/unit/**/*.test.{js,jsx}'],
    clearMocks: true,
    restoreMocks: true,
    passWithNoTests: false,
    allowOnly: false,
    retry: 0,
    reporters: ['default', new UnitCompletionReporter(manifest)],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx'],
      reporter: ['text', 'json-summary', 'lcov', 'html'],
      reportsDirectory: 'coverage',
    },
  },
})
