import { test, expect, type Browser } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4324';

test.beforeAll(async () => {
  const home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(
    join(home, '.config', 'zenterm', '.env'),
    `AUTH_TOKEN=${TOKEN}\nPORT=18795\nHOST=127.0.0.1\n`,
  );

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: { ...process.env, HOME: home, PORT: '18795', HOST: '127.0.0.1', AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error' },
    stdio: 'inherit',
  });
  baseUrl = 'http://127.0.0.1:18795';

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

async function loginIn(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'system', language: 'en', fontSize: 14 }, version: 1,
    }));
  });
  await page.goto(`${baseUrl}/web`);
  await fillOtp(page, TOKEN);
  await page.getByRole('button', { name: /Sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible();
  return { context, page };
}

test('session created in tab A appears in tab B via /ws/events', async ({ browser }) => {
  const a = await loginIn(browser);
  const b = await loginIn(browser);
  try {
    await a.page.getByRole('button', { name: /New session/ }).click();
    await a.page.getByRole('textbox', { name: /New session/ }).fill('e2e_realtime');
    await a.page.keyboard.press('Enter');
    await expect(b.page.getByText('e2e_realtime')).toBeVisible({ timeout: 5000 });
  } finally {
    await a.context.close();
    await b.context.close();
  }
});

test('session renamed in tab A reflects in tab B', async ({ browser }) => {
  await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'e2e_sync' }),
  });

  const a = await loginIn(browser);
  const b = await loginIn(browser);
  try {
    await expect(a.page.getByText('e2e_sync')).toBeVisible();
    await expect(b.page.getByText('e2e_sync')).toBeVisible();

    await a.page.getByText('e2e_sync').hover();
    await a.page.getByLabel('Actions for session e2e_sync').click({ force: true });
    await a.page.getByRole('menuitem', { name: /Rename/ }).click();
    const input = a.page.getByRole('textbox', { name: /Rename e2e_sync/ });
    await input.fill('e2e_synced');
    await a.page.keyboard.press('Enter');

    await expect(b.page.getByText('e2e_synced')).toBeVisible({ timeout: 5000 });
  } finally {
    await a.context.close();
    await b.context.close();
  }
});
