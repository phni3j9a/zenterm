import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4800';
const PORT = 18800;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(join(home, '.config', 'zenterm', '.env'), `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`);

  mkdirSync(join(home, 'src'), { recursive: true });
  writeFileSync(join(home, 'README.md'), '# hello world\n');
  writeFileSync(join(home, 'src', 'a.ts'), 'export const x = 1;\n');

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

test('browse: home → sub directory → breadcrumb back', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'dark', language: 'en', fontSize: 14 }, version: 1,
    }));
  });

  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  // LeftRail (Phase 6 G5): tab switching moved from Sidebar footer to LeftRail tablist
  await page.getByRole('tab', { name: /files/i }).click();
  await expect(page).toHaveURL(/\/web\/files$/);

  await expect(page.getByRole('button', { name: /^src$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^README\.md$/ })).toBeVisible();

  await page.getByRole('button', { name: /^src$/ }).click();
  await expect(page.getByRole('button', { name: /^a\.ts$/ })).toBeVisible();

  await page.getByRole('button', { name: /^Home$/ }).click();
  await expect(page.getByRole('button', { name: /^README\.md$/ })).toBeVisible();
});
