import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { UnitCompletionReporter, validateManifest } from '../scripts/offline-runner.mjs'

const manifest = validateManifest()

export default defineConfig({
  envDir: false,
  plugins: [react()],
  test: {
    // Set before application imports, even when a laptop exports production settings.
    // Individual deployment tests can still override these with vi.stubEnv.
    env: {
      VERCEL: '',
      VITE_API_BASE_URL: '/api/v1',
      VITE_API_PROXY_TARGET: 'http://127.0.0.1:8000',
      VITE_GOOGLE_CLIENT_ID: '',
    },
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
