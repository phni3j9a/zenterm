import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { createGatewayEnv, fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4804';
const PORT = 18804;
let home: string;

test.beforeAll(async () => {
  let env: NodeJS.ProcessEnv;
  ({ home, env } = createGatewayEnv({ port: PORT, token: TOKEN, label: 'zenterm-files-mkdir' }));

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

test('mkdir: create new folder via toolbar', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'dark', language: 'en', fontSize: 14 }, version: 1,
    }));
  });

  await page.goto(`${baseUrl}/web`);
  await fillOtp(page, TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  await page.getByRole('button', { name: /Files tab/i }).click();
  await expect(page).toHaveURL(/\/web\/files$/);

  // Open the New menu (the toolbar button has aria-label "New File").
  // Use exact name to avoid matching the menuitem with the same label.
  await page.getByRole('button', { name: 'New File', exact: true }).click();
  await page.getByRole('menuitem', { name: /^New Folder$/ }).click();

  const dialogInput = page.getByRole('textbox', { name: /folder name/ });
  await expect(dialogInput).toBeVisible();
  await dialogInput.fill('mydir');
  await page.getByRole('button', { name: /^OK$/ }).click();

  await expect(page.getByRole('button', { name: /^mydir$/ })).toBeVisible({ timeout: 5000 });
  expect(statSync(join(home, 'mydir')).isDirectory()).toBe(true);
});
