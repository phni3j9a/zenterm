import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createGatewayEnv, fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4805';
const PORT = 18805;
let home: string;

test.beforeAll(async () => {
  let env: NodeJS.ProcessEnv;
  ({ home, env } = createGatewayEnv({ port: PORT, token: TOKEN, label: 'zenterm-files-copypaste' }));

  mkdirSync(join(home, 'dst'), { recursive: true });
  writeFileSync(join(home, 'src.txt'), 'copy me\n');

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

test('copy and paste: source file copied into target directory', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'dark', language: 'en', fontSize: 14 }, version: 1,
    }));
  });

  await page.goto(`${baseUrl}/web`);
  await fillOtp(page, TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  await page.getByRole('tab', { name: /^files$/i }).click();
  await expect(page).toHaveURL(/\/web\/files$/);

  // Copy src.txt via context menu
  await page.getByRole('button', { name: /^src\.txt$/ }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^Copy$/ }).click();

  // Navigate into dst directory
  await page.getByRole('button', { name: /^dst$/ }).click();

  // Paste bar should be visible with a Paste button
  const pasteBtn = page.getByRole('button', { name: /^Paste$/ });
  await expect(pasteBtn).toBeVisible();
  await pasteBtn.click();

  // Confirm src.txt now appears inside dst (file list)
  await expect(page.getByRole('button', { name: /^src\.txt$/ })).toBeVisible({ timeout: 5000 });

  expect(existsSync(join(home, 'dst', 'src.txt'))).toBe(true);
  expect(existsSync(join(home, 'src.txt'))).toBe(true);
});
