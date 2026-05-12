import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4809';
const PORT = 18809;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(
    join(home, '.config', 'zenterm', '.env'),
    `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`,
  );

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: {
      ...process.env, HOME: home, PORT: String(PORT), HOST: '127.0.0.1',
      AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error',
    },
    stdio: 'inherit',
  });
  baseUrl = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(async () => {
  try {
    await fetch(`${baseUrl}/api/sessions/e2e-ctx`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  } catch { /* ignore */ }
  gateway?.kill();
});

test('right-click opens menu; Clear empties xterm rows', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const created = await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'e2e-ctx' }),
  });
  expect(created.ok).toBe(true);

  await page.addInitScript(() => {
    localStorage.setItem(
      'zenterm-web-settings',
      JSON.stringify({
        state: { themeMode: 'dark', language: 'en', fontSize: 14, autoCopyOnSelect: false },
        version: 2,
      }),
    );
  });

  await page.goto(`${baseUrl}/web`);
  await fillOtp(page, TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });
  await page.getByText('e2e-ctx').click();
  await expect(page.getByLabel(/Connection Connected/i)).toBeVisible({ timeout: 5000 });

  // Type something so the buffer has content.
  await page.locator('.xterm-helper-textarea').focus();
  const marker = `CTX_${Date.now()}`;
  await page.keyboard.type(`echo ${marker}`);
  await page.keyboard.press('Enter');
  await expect(page.locator('.xterm-rows')).toContainText(marker, { timeout: 5000 });

  // Right-click on the xterm.
  await page.locator('.xterm-screen').click({ button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /^Copy$/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /^Paste$/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /^Clear$/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /^Reconnect$/ })).toBeVisible();

  await page.getByRole('menuitem', { name: /^Clear$/ }).click();

  // After Clear, the marker should no longer appear in the visible rows.
  await expect(page.locator('.xterm-rows')).not.toContainText(marker, { timeout: 3000 });

  // Menu should have closed.
  await expect(page.getByRole('menu')).toBeHidden();
});
