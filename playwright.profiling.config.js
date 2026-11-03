import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './performance',
  testMatch: '**/browser-scaling-profile.spec.js',
  fullyParallel: false,
  workers: 1,
  timeout: 1_800_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  outputDir: './test-results/performance-profiles/playwright-output',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    channel: 'msedge',
    headless: true,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: {
    command: 'npm run preview -- --configLoader native --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
