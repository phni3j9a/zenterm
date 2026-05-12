import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createGatewayEnv, fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4790';
const PORT = 18790;

test.beforeAll(async () => {
  const { env } = createGatewayEnv({ port: PORT, token: TOKEN, label: 'zenterm-settings-tab' });
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

test('switching to Settings tab navigates to /web/settings and keeps TerminalPane mounted', async ({ page }) => {
  // Force English locale
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'system', language: 'en', fontSize: 14 }, version: 1,
    }));
  });

  // Login first
  await page.goto(`${baseUrl}/web`);
  await fillOtp(page, TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  // Click Settings tab
  await page.getByRole('button', { name: /settings tab/i }).click();
  await expect(page).toHaveURL(/\/web\/settings$/);
  await expect(page.getByRole('region', { name: /appearance/i })).toBeVisible();

  // Click Sessions tab to navigate back
  await page.getByRole('button', { name: /sessions tab/i }).click();
  await expect(page).toHaveURL(/\/web\/sessions/);
});
