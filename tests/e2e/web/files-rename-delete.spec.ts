import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createGatewayEnv, fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4803';
const PORT = 18803;
let home: string;

test.beforeAll(async () => {
  let env: NodeJS.ProcessEnv;
  ({ home, env } = createGatewayEnv({ port: PORT, token: TOKEN, label: 'zenterm-files-renamedelete' }));

  writeFileSync(join(home, 'oldname.txt'), 'rename me\n');
  writeFileSync(join(home, 'doomed.txt'), 'delete me\n');

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

test('rename and delete via context menu', async ({ page }) => {
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

  // --- Rename ---
  await page.getByRole('button', { name: /^oldname\.txt$/ }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^Rename$/ }).click();

  const dialogInput = page.getByRole('textbox', { name: /filename\.ext/ });
  await expect(dialogInput).toBeVisible();
  await dialogInput.fill('newname.txt');
  await page.getByRole('button', { name: /^OK$/ }).click();

  await expect(page.getByRole('button', { name: /^newname\.txt$/ })).toBeVisible({ timeout: 5000 });
  expect(existsSync(join(home, 'oldname.txt'))).toBe(false);
  expect(existsSync(join(home, 'newname.txt'))).toBe(true);

  // --- Delete ---
  await page.getByRole('button', { name: /^doomed\.txt$/ }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^Delete$/ }).click();

  // Confirm dialog: there is also a (now-closed) context menu Delete item.
  // Use .last() to pick the dialog's confirm button.
  await page.getByRole('button', { name: /^Delete$/ }).last().click();

  await expect(page.getByRole('button', { name: /^doomed\.txt$/ })).toHaveCount(0, { timeout: 5000 });
  expect(existsSync(join(home, 'doomed.txt'))).toBe(false);
});
