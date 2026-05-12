import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createGatewayEnv, fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4812';
const PORT = 18812;

test.beforeAll(async () => {
  const { env } = createGatewayEnv({ port: PORT, token: TOKEN, label: 'zenterm-shortcuts' });
  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env,
    stdio: 'inherit',
  });
  baseUrl = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${baseUrl}/health`);
      if (r.ok) return;
    } catch { /* ignore */ }
    await new Promise((res) => setTimeout(res, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(async () => {
  gateway?.kill();
});

// On Linux, the web app uses Ctrl as the primary modifier (isMac() returns false).
// Playwright's Meta key maps to the Super/Meta key on Linux, NOT Ctrl.
// So we must use Control+K / Control+B here.

test('Ctrl+K opens Command Palette; Escape closes', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'dark', language: 'en', fontSize: 14, autoCopyOnSelect: false },
      version: 2,
    }));
  });
  await page.goto(`${baseUrl}/web`);
  await fillOtp(page, TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: /command palette/i })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /command palette/i })).toBeHidden();
});

test('Ctrl+B toggles sidebar', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'dark', language: 'en', fontSize: 14, autoCopyOnSelect: false },
      version: 2,
    }));
  });
  await page.goto(`${baseUrl}/web`);
  await fillOtp(page, TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  // Use locator('aside') instead of getByRole('complementary') because when the sidebar
  // is collapsed, aria-hidden="true" is set, which removes it from the accessibility tree
  // and causes getByRole('complementary') to find no element.
  const aside = page.locator('aside[role="complementary"]');
  await expect(aside).toBeVisible();
  await page.keyboard.press('Control+b');
  await expect(aside).toHaveAttribute('aria-hidden', 'true');
  await page.keyboard.press('Control+b');
  await expect(aside).not.toHaveAttribute('aria-hidden', 'true');
});
