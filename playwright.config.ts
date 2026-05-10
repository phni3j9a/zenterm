import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './playwright-artifacts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // All specs share the same tmux server, so concurrent spec execution
  // causes cross-spec session cleanup races. Run spec files serially.
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:18765',
    headless: true,
    screenshot: 'on',
    video: 'off',
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
