import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4806';
const PORT = 18806;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(join(home, '.config', 'zenterm', '.env'), `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`);

  writeFileSync(join(home, 'download-me.txt'), 'download-payload');

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

async function login(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'dark', language: 'en', fontSize: 14 }, version: 1,
    }));
  });

  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  await page.getByRole('button', { name: /Files tab/i }).click();
  await expect(page).toHaveURL(/\/web\/files$/);
}

test('upload: file picker uploads file to current directory', async ({ page }) => {
  await login(page);

  const uploadInput = page.locator('input[data-testid="files-upload-input"]');
  await uploadInput.setInputFiles({
    name: 'uploaded.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('uploaded-payload'),
  });

  await expect(page.getByRole('button', { name: /^uploaded\.txt$/ })).toBeVisible({ timeout: 5000 });

  // Allow file system flush
  await page.waitForTimeout(200);
  expect(existsSync(join(home, 'uploaded.txt'))).toBe(true);
  expect(readFileSync(join(home, 'uploaded.txt'), 'utf-8')).toBe('uploaded-payload');
});

test('download: header Download button delivers file blob', async ({ page }) => {
  await login(page);

  await page.getByRole('button', { name: /^download-me\.txt$/ }).click();

  const downloadButton = page.getByRole('button', { name: /^Download$/ });
  await expect(downloadButton).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    downloadButton.click(),
  ]);

  expect(download.suggestedFilename()).toBe('download-me.txt');

  const path = await download.path();
  expect(path).toBeTruthy();
  const body = readFileSync(path!, 'utf-8');
  expect(body).toBe('download-payload');
});
