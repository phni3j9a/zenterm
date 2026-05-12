import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createGatewayEnv, fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4322';

test.beforeAll(async () => {
  const { env } = createGatewayEnv({ port: 18797, token: TOKEN, label: 'zenterm-sessions' });
  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env,
    stdio: 'inherit',
  });
  baseUrl = 'http://127.0.0.1:18797';

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
  // Clean up any sessions created during the test (best-effort)
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

test('creates a session through the sidebar UI', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'system', language: 'en', fontSize: 14 }, version: 1,
    }));
  });
  await page.goto(`${baseUrl}/web`);
  await fillOtp(page, TOKEN);
  await page.getByRole('button', { name: /Sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible();

  await page.getByRole('button', { name: /New session/ }).click();
  await page.getByRole('textbox', { name: /New session/ }).fill('e2e_create');
  await page.keyboard.press('Enter');

  await expect(page.getByText('e2e_create')).toBeVisible({ timeout: 5000 });

  const apiList = await fetch(`${baseUrl}/api/sessions`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const sessions = (await apiList.json()) as Array<{ displayName: string }>;
  expect(sessions.some((s) => s.displayName === 'e2e_create')).toBe(true);
});

test('renames a session through kebab menu', async ({ page }) => {
  await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'e2e_rename' }),
  });

  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'system', language: 'en', fontSize: 14 }, version: 1,
    }));
  });
  await page.goto(`${baseUrl}/web`);
  await fillOtp(page, TOKEN);
  await page.getByRole('button', { name: /Sign in/i }).click();
  await expect(page.getByText('e2e_rename')).toBeVisible();

  await page.getByText('e2e_rename').hover();
  await page.getByLabel('Actions for session e2e_rename').click({ force: true });
  await page.getByRole('menuitem', { name: /Rename/ }).click();
  const input = page.getByRole('textbox', { name: /Rename e2e_rename/ });
  await input.fill('e2e_renamed');
  await page.keyboard.press('Enter');

  await expect(page.getByText('e2e_renamed')).toBeVisible({ timeout: 5000 });
});

test('deletes a session through kebab → confirm', async ({ page }) => {
  await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'e2e_delete' }),
  });

  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'system', language: 'en', fontSize: 14 }, version: 1,
    }));
  });
  await page.goto(`${baseUrl}/web`);
  await fillOtp(page, TOKEN);
  await page.getByRole('button', { name: /Sign in/i }).click();
  await expect(page.getByText('e2e_delete')).toBeVisible();

  await page.getByText('e2e_delete').hover();
  await page.getByLabel('Actions for session e2e_delete').click({ force: true });
  await page.getByRole('menuitem', { name: /Delete/ }).click();
  await expect(page.getByText(/Delete session/)).toBeVisible();
  await page.getByRole('button', { name: /^Delete$/ }).click();

  // Wait for session row to disappear (the button whose name starts with e2e_delete)
  await expect(page.getByRole('button', { name: /^e2e_delete/ })).not.toBeVisible({ timeout: 5000 });
});
