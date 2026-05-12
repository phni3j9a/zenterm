import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGatewayEnv, fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4807';
const PORT = 18807;
test.beforeAll(async () => {
  const { home, env } = createGatewayEnv({ port: PORT, token: TOKEN, label: 'zenterm-term-mount' });
  // Seed at least one file so the Files panel has something visible.
  writeFileSync(join(home, 'README.md'), '# hello\n');

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

test.afterAll(async () => {
  try {
    await fetch(`${baseUrl}/api/sessions/e2e-mount`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  } catch { /* ignore */ }
  gateway?.kill();
});

test('terminal scrollback survives Files navigation', async ({ page }) => {
  // Pre-create a session so Sidebar shows it.
  const created = await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'e2e-mount' }),
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

  // Open the session.
  await page.getByText('e2e-mount').click();
  await expect(page.getByLabel(/Connection Connected/i)).toBeVisible({ timeout: 5000 });

  // Type a marker into the terminal so we can verify scrollback persists.
  await page.locator('.xterm-helper-textarea').focus();
  const marker = `MOUNT_KEEP_${Date.now()}`;
  await page.keyboard.type(`echo ${marker}`);
  await page.keyboard.press('Enter');
  await expect(page.locator('.xterm-rows')).toContainText(marker, { timeout: 5000 });

  // Navigate to Files.
  await page.getByRole('button', { name: /Files tab/i }).click();
  await expect(page).toHaveURL(/\/web\/files$/);
  await expect(page.getByRole('button', { name: /^README\.md$/ })).toBeVisible({ timeout: 5000 });

  // Navigate back to Sessions.
  await page.getByRole('button', { name: /Sessions tab/i }).click();
  await expect(page).toHaveURL(/\/web\/sessions$/);

  // Connection should still be Connected (no reconnect happened).
  await expect(page.getByLabel(/Connection Connected/i)).toBeVisible();

  // The marker line must still be in the xterm DOM (proving scrollback survived).
  await expect(page.locator('.xterm-rows')).toContainText(marker);
});
