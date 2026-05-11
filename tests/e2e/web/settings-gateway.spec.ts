import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4794';
const PORT = 18794;

test.beforeAll(async () => {
  const home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(join(home, '.config', 'zenterm', '.env'), `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`);

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: { ...process.env, HOME: home, PORT: String(PORT), HOST: '127.0.0.1', AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error' },
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

const initEnglish = () => {
  localStorage.setItem('zenterm-web-settings', JSON.stringify({
    state: { themeMode: 'system', language: 'en', fontSize: 14 }, version: 1,
  }));
};

const loginAndGoToSettings = async (page: import('@playwright/test').Page, url: string, token: string) => {
  await page.goto(`${url}/web`);
  await page.getByLabel(/Token/i).fill(token);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /settings tab/i }).click();
  await expect(page).toHaveURL(/\/web\/settings$/);
};

test('Show mobile QR opens modal with zenterm:// URL', async ({ page }) => {
  await page.addInitScript(initEnglish);
  await loginAndGoToSettings(page, baseUrl, TOKEN);

  // Click "Show mobile QR"
  await page.getByRole('button', { name: /show mobile qr/i }).click();

  // Assert QR modal is visible (heading "Pair mobile app" rendered inside the open dialog)
  const qrHeading = page.getByRole('heading', { name: /pair mobile app/i });
  await expect(qrHeading).toBeVisible({ timeout: 3000 });
  // The open dialog contains the zenterm:// pairing URL
  await expect(page.locator('dialog[open]')).toContainText('zenterm://connect');

  // Close the modal
  await page.getByRole('button', { name: /close/i }).click();
  await expect(qrHeading).not.toBeVisible({ timeout: 3000 });
});

test('Logout returns to /web/login', async ({ page }) => {
  await page.addInitScript(initEnglish);
  await loginAndGoToSettings(page, baseUrl, TOKEN);

  // Click Logout button
  await page.getByRole('button', { name: /^logout$/i }).click();

  // A confirm dialog should appear — click the confirm button (label: "Logout")
  const confirmDialog = page.getByRole('dialog');
  await expect(confirmDialog).toBeVisible({ timeout: 3000 });
  await confirmDialog.getByRole('button', { name: /logout/i }).click();

  // Assert URL redirects to login
  await expect(page).toHaveURL(/\/web\/login$/, { timeout: 5000 });
});
