import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGatewayEnv, fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4801';
const PORT = 18801;
let home: string;

test.beforeAll(async () => {
  let env: NodeJS.ProcessEnv;
  ({ home, env } = createGatewayEnv({ port: PORT, token: TOKEN, label: 'zenterm-files-preview' }));

  writeFileSync(join(home, 'note.txt'), 'line one\nline two\nline three\n');

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

test('preview: click text file shows header and body', async ({ page }) => {
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

  await page.getByRole('button', { name: /^note\.txt$/ }).click();

  await expect(page.getByText(/note\.txt/).first()).toBeVisible();
  await expect(page.getByText('line one').first()).toBeVisible();
  await expect(page.getByText('line three').first()).toBeVisible();
});
