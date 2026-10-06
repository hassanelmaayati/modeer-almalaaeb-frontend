import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { frontend, servers } from './helpers/runtime.js';
export default defineConfig({
  testDir: './e2e', testMatch: 'realtime.spec.js', fullyParallel: false, workers: 1, retries: 0, forbidOnly: true,
  timeout: 40_000, globalTimeout: 10 * 60_000, expect: { timeout: 8_000 }, outputDir: './artifacts/proxy',
  reporter: [['list'], ['json', { outputFile: path.join(frontend, 'tests/artifacts/proxy-results.json') }]],
  use: { baseURL: 'http://127.0.0.1:5174', serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium-proxy', use: { ...devices['Desktop Chrome'] } }], webServer: servers(false),
});
