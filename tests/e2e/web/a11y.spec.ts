import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import { createGatewayEnv } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4815';
const PORT = 18815;

test.beforeAll(async () => {
  const { env } = createGatewayEnv({ port: PORT, token: TOKEN, label: 'zenterm-a11y' });
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

async function loginAndWait(page: import('@playwright/test').Page, path = '/web/sessions') {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'dark', language: 'en', fontSize: 14, autoCopyOnSelect: false },
      version: 2,
    }));
  });
  await page.goto(`${baseUrl}${path}`);
  // Fill each OTP digit box individually (new OTP input design in Phase 6 G4)
  const digits = TOKEN.split('');
  for (let i = 0; i < digits.length; i++) {
    await page.getByLabel(`Digit ${i + 1}`).fill(digits[i]);
  }
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('aside[role="complementary"]')).toBeVisible({ timeout: 5000 });
}

test('a11y: login page (unauthenticated)', async ({ page }) => {
  // Set language to English before loading so label text is predictable
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'dark', language: 'en', fontSize: 14, autoCopyOnSelect: false },
      version: 2,
    }));
  });
  await page.goto(`${baseUrl}/web/login`);
  await expect(page.getByLabel('Digit 1')).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});

test('a11y: sessions panel', async ({ page }) => {
  await loginAndWait(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});

test('a11y: files panel', async ({ page }) => {
  await loginAndWait(page, '/web/files');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});

test('a11y: settings panel', async ({ page }) => {
  await loginAndWait(page, '/web/settings');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});

test('a11y: command palette open', async ({ page }) => {
  await loginAndWait(page);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: /command palette/i })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});
