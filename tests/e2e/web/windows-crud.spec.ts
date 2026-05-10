import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4323';

test.beforeAll(async () => {
  const home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(
    join(home, '.config', 'zenterm', '.env'),
    `AUTH_TOKEN=${TOKEN}\nPORT=18796\nHOST=127.0.0.1\n`,
  );

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: { ...process.env, HOME: home, PORT: '18796', HOST: '127.0.0.1', AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error' },
    stdio: 'inherit',
  });
  baseUrl = 'http://127.0.0.1:18796';

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
    const res = await fetch(`${baseUrl}/api/sessions`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (res.ok) {
      const sessions = (await res.json()) as Array<{ displayName: string }>;
      for (const s of sessions) {
        await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(s.displayName)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${TOKEN}` },
        });
      }
    }
  } catch {
    /* ignore */
  }
  gateway?.kill();
});

test('creates, renames, and deletes a window in a session', async ({ page }) => {
  // Pre-create a session via API
  await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'e2e_win' }),
  });

  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /Connect/i }).click();
  await expect(page.getByText('e2e_win')).toBeVisible();

  // Pre-create a 2nd window via API so the expand chevron will appear
  await fetch(`${baseUrl}/api/sessions/e2e_win/windows`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'second' }),
  });

  // Wait for events refetch to surface the second window in the UI
  await page.waitForTimeout(1000);

  // Now expand the session to reveal "+ window" and the existing windows
  await page.getByLabel(/Expand windows/).click();
  await expect(page.getByRole('button', { name: /\+ window/ })).toBeVisible();

  // Create a new window through the UI
  await page.getByRole('button', { name: /\+ window/ }).click();
  await page.getByRole('textbox', { name: /新規 window 名/ }).fill('logs');
  await page.keyboard.press('Enter');
  await expect(page.getByText('logs')).toBeVisible({ timeout: 5000 });

  // Rename 'second' window
  await page.getByText('second').hover();
  await page.getByLabel('Actions for window second').click({ force: true });
  await page.getByRole('menuitem', { name: /Rename/ }).click();
  const renameInput = page.getByRole('textbox', { name: /window 名を編集/ });
  await renameInput.fill('renamed');
  await page.keyboard.press('Enter');
  await expect(page.getByText('renamed')).toBeVisible({ timeout: 5000 });

  // Delete 'logs' window
  await page.getByText('logs').hover();
  await page.getByLabel('Actions for window logs').click({ force: true });
  await page.getByRole('menuitem', { name: /Delete/ }).click();
  await expect(page.getByText(/logs を削除しますか/)).toBeVisible();
  await page.getByRole('button', { name: '削除' }).click();
  // Use a strict locator to avoid matching the dialog text
  await expect(page.getByRole('button', { name: /^logs/ })).not.toBeVisible({ timeout: 5000 });
});
