import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// 前提: gateway が 18815 で起動済 (a11y.spec.ts と同じ起動を流用するか別途立ち上げ)
// このスクリプトは手動で実行する。CI には含めない。

const BASE_URL = process.env.SHOT_BASE_URL ?? 'http://127.0.0.1:18815';
const TOKEN = process.env.SHOT_TOKEN ?? '4815';
const OUT = 'docs/screenshots';

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

async function login(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'dark', language: 'en', fontSize: 14, autoCopyOnSelect: false },
      version: 2,
    }));
  });
  await page.goto(`${BASE_URL}/web/login`);
}

test('shot: login', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.screenshot({ path: `${OUT}/web-pc-login.png`, fullPage: false });
});

test('shot: sessions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.locator('aside[role="complementary"]').waitFor();
  // Create a couple sessions for visual richness
  await page.evaluate(async (token) => {
    for (const name of ['code', 'logs', 'tests']) {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
    }
  }, TOKEN);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/web-pc-sessions.png` });
});

test('shot: files', async ({ page }) => {
  await login(page);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.goto(`${BASE_URL}/web/files`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/web-pc-files.png` });
});

test('shot: settings', async ({ page }) => {
  await login(page);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.goto(`${BASE_URL}/web/settings`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/web-pc-settings.png` });
});

test('shot: multi-pane', async ({ page }) => {
  await login(page);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.locator('aside[role="complementary"]').waitFor();
  // Force grid-2x2 + 4 panes via store init
  await page.evaluate(async (token) => {
    for (const name of ['p1', 'p2', 'p3', 'p4']) {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
    }
  }, TOKEN);
  await page.goto(`${BASE_URL}/web/sessions#l=grid-2x2&p=p1.0,p2.0,p3.0,p4.0`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/web-pc-multi-pane.png` });
});
