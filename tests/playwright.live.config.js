import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontend = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

export default defineConfig({
  testDir: './e2e',
  testMatch: 'live.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  outputDir: './artifacts/live',
  reporter: [['list'], ['html', { outputFolder: path.join(frontend, 'tests/artifacts/live-report'), open: 'never' }]],
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
