/**
 * Phase 6 G10 E2E — empty-state unification.
 *
 * Verifies that:
 *   1. The main terminal area shows an EmptyState (role="status") when no pane
 *      is selected (fresh gateway, no sessions).
 *   2. The Files tab shows an EmptyState when opened without a session.
 *   3. The sessions sidebar shows its EmptyState when there are no sessions.
 *
 * Gateway port 18817 (distinct from other phase6 specs).
 */
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4817';
const PORT = 18817;

test.beforeAll(async () => {
  const home = mkdtempSync(join(tmpdir(), 'zenterm-p6-empty-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(
    join(home, '.config', 'zenterm', '.env'),
    `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`,
  );
  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: {
      ...process.env,
      HOME: home,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      AUTH_TOKEN: TOKEN,
      LOG_LEVEL: 'error',
    },
    stdio: 'inherit',
  });
  baseUrl = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${baseUrl}/health`);
      if (r.ok) return;
    } catch {
      /* ignore */
    }
    await new Promise((res) => setTimeout(res, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(async () => {
  gateway?.kill();
});

/** Login with forced English locale and wait for the sidebar. */
async function loginAndWait(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'zenterm-web-settings',
      JSON.stringify({
        state: { themeMode: 'dark', language: 'en', fontSize: 14, autoCopyOnSelect: false },
        version: 2,
      }),
    );
  });
  await page.goto(`${baseUrl}/web/login`);
  await fillOtp(page, TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('aside[role="complementary"]')).toBeVisible({ timeout: 5000 });
}

test('main empty state visible when no pane selected', async ({ page }) => {
  await loginAndWait(page);
  // On fresh gateway with no sessions, main area shows shell.empty EmptyState
  await expect(
    page.getByRole('status').filter({ hasText: /select a session|sessions yet|assign a session/i }).first()
  ).toBeVisible({ timeout: 5000 });
});

test('sidebar shows no-sessions empty state', async ({ page }) => {
  await loginAndWait(page);
  // Sessions list panel should display its EmptyState (sessions.empty.title)
  await expect(
    page.getByRole('status').filter({ hasText: /sessions yet|no sessions/i }).first()
  ).toBeVisible({ timeout: 5000 });
});

test('files tab shows empty state', async ({ page }) => {
  await loginAndWait(page);
  // Click the Files tab
  await page.getByRole('tab', { name: /files/i }).click();
  // Either the directory-empty or viewer-empty EmptyState should be visible
  await expect(
    page.getByRole('status').filter({ hasText: /no file selected|empty directory|drag|assign a session|select a session/i }).first()
  ).toBeVisible({ timeout: 5000 });
});
