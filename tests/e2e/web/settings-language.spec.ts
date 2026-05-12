import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createGatewayEnv, fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4792';
const PORT = 18792;

test.beforeAll(async () => {
  const { env } = createGatewayEnv({ port: PORT, token: TOKEN, label: 'zenterm-settings-language' });
  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env,
    stdio: 'inherit',
  });
  baseUrl = `http://127.0.0.1:${PORT}`;

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(() => {
  gateway?.kill();
});

test('language switch updates UI strings', async ({ page }) => {
  // Force English locale initially
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'system', language: 'en', fontSize: 14 }, version: 1,
    }));
  });

  // Login
  await page.goto(`${baseUrl}/web`);
  await fillOtp(page, TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  // Navigate to Settings (Phase 6 G5: LeftRail uses role="tab")
  await page.getByRole('tab', { name: /^settings$/i }).click();
  await expect(page).toHaveURL(/\/web\/settings$/);

  // Select Japanese language
  await page.getByLabel(/Language/i).selectOption('ja');

  // Assert Japanese "Appearance" heading is visible
  await expect(page.getByText('外観')).toBeVisible({ timeout: 3000 });

  // Switch back to English
  await page.getByLabel(/Language|言語/i).selectOption('en');

  // Assert English "Appearance" is visible
  await expect(page.getByText('Appearance')).toBeVisible({ timeout: 3000 });
});
