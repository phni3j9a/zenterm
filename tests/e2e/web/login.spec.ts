import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createGatewayEnv, fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4321';

test.beforeAll(async () => {
  const { env } = createGatewayEnv({ port: 18799, token: TOKEN, label: 'zenterm-login' });
  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env,
    stdio: 'inherit',
  });
  baseUrl = 'http://127.0.0.1:18799';

  // Wait for gateway to be ready
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

test('login with valid token navigates to sessions screen', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'system', language: 'en', fontSize: 14 }, version: 1,
    }));
  });
  await page.goto(`${baseUrl}/web`);
  await expect(page.getByRole('heading', { name: /Sign in to ZenTerm/i })).toBeVisible();
  await fillOtp(page, TOKEN);
  await page.getByRole('button', { name: /Sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });
});

test('login with wrong token shows error', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'system', language: 'en', fontSize: 14 }, version: 1,
    }));
  });
  await page.goto(`${baseUrl}/web`);
  await fillOtp(page, '0000');
  await page.getByRole('button', { name: /Sign in/i }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});
