import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { frontend, servers } from './helpers/runtime.js';
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, retries: 0, forbidOnly: true,
  timeout: 30_000, globalTimeout: 20 * 60_000, expect: { timeout: 8_000 }, outputDir: './artifacts/production',
  reporter: [['list'], ['json', { outputFile: path.join(frontend, 'tests/artifacts/production-results.json') }], ['html', { outputFolder: path.join(frontend, 'tests/artifacts/production-report'), open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:5174', serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', testMatch: ['integration.spec.js', 'journeys.spec.js', 'smoke.spec.js'], use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', testMatch: 'smoke.spec.js', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testMatch: 'smoke.spec.js', use: { ...devices['Desktop Safari'] } },
  ], webServer: servers(true),
});
