import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '5432';

test.beforeAll(async () => {
  const home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(
    join(home, '.config', 'zenterm', '.env'),
    `AUTH_TOKEN=${TOKEN}\nPORT=18798\nHOST=127.0.0.1\n`,
  );

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: { ...process.env, HOME: home, PORT: '18798', HOST: '127.0.0.1', AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error' },
    stdio: 'inherit',
  });
  baseUrl = 'http://127.0.0.1:18798';

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
  // Cleanup: kill any session created during test
  try {
    await fetch(`${baseUrl}/api/sessions/e2e-term`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  } catch { /* ignore */ }
  gateway?.kill();
});

test('opens a terminal and sees command output', async ({ page }) => {
  // Pre-create a session via API so the sidebar has something to show
  const created = await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'e2e-term' }),
  });
  expect(created.ok).toBe(true);

  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'system', language: 'en', fontSize: 14 }, version: 1,
    }));
  });
  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /Sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  // Click the session
  await page.getByText('e2e-term').click();

  // Wait for connection status to be 'connected'
  await expect(page.getByLabel(/Connection connected/i)).toBeVisible({ timeout: 5000 });

  // Type a command and assert output appears in xterm DOM
  await page.locator('.xterm-helper-textarea').focus();
  await page.keyboard.type('echo hello-from-e2e');
  await page.keyboard.press('Enter');

  await expect(page.locator('.xterm-rows')).toContainText('hello-from-e2e', { timeout: 5000 });
});
