import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4811';
const PORT = 18811;

test.beforeAll(async () => {
  const home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
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
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch { /* ignore */ }
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
  } catch { /* */ }
  gateway?.kill();
});

test('switching layout to cols-2 renders 2 panes and Sidebar duplicate guard works', async ({ page }) => {
  for (const name of ['e2e-pane-a', 'e2e-pane-b']) {
    const r = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    expect(r.ok).toBe(true);
  }

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
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  await page.getByText('e2e-pane-a').click();
  await expect(page.getByLabel(/Connection Connected/i)).toBeVisible({ timeout: 5000 });

  await page.getByRole('button', { name: /change layout/i }).click();
  await page.getByRole('menuitemradio', { name: /2 cols/i }).click();

  // After switching to cols-2 with only pane 0 assigned, pane 1 is empty
  // (rendered as <main> with selectPrompt text). Focus it, then assign e2e-pane-b.
  const emptyPane = page.getByText(/Select a session from the sidebar/i);
  await expect(emptyPane).toBeVisible({ timeout: 5000 });
  await emptyPane.click();

  await page.getByText('e2e-pane-b').click();
  await expect(page.locator('section[data-terminal-root="true"]')).toHaveCount(2, { timeout: 10000 });
  await expect(page.getByLabel(/Connection Connected/i).nth(1)).toBeVisible({ timeout: 5000 });

  await fetch(`${baseUrl}/api/sessions/e2e-pane-a/windows`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'second' }),
  });

  // Wait for events refetch to surface the second window so e2e-pane-a has 2 windows
  // (Expand chevron only appears when a session has >1 window).
  await page.waitForTimeout(1500);

  // Expand e2e-pane-a's windows. Use .first() since e2e-pane-a is listed first
  // in the Active sessions panel.
  await page.getByLabel(/Expand windows/i).first().click();

  // Window 0 of e2e-pane-a is occupied in pane 0 (left); focused is pane 1.
  // The row's label is prefixed with ⛔ and is disabled.
  const occupiedRow = page.getByRole('button', { name: /^⛔ / }).first();
  await expect(occupiedRow).toBeVisible({ timeout: 5000 });
  await expect(occupiedRow).toBeDisabled();
});

test('cols-2 → single drops the non-focused pane', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'zenterm-web-pane',
      JSON.stringify({
        state: {
          layout: 'cols-2',
          panes: [
            { sessionId: 'e2e-pane-a', windowIndex: 0 },
            { sessionId: 'e2e-pane-b', windowIndex: 0 },
          ],
          focusedIndex: 1,
          ratios: {
            single: [], 'cols-2': [0.5], 'cols-3': [1/3, 0.5],
            'grid-2x2': [0.5, 0.5], 'main-side-2': [0.6, 0.5],
          },
          savedLayout: null,
        },
        version: 1,
      }),
    );
    localStorage.setItem(
      'zenterm-web-settings',
      JSON.stringify({
        state: { themeMode: 'dark', language: 'en', fontSize: 14, autoCopyOnSelect: false },
        version: 2,
      }),
    );
  });

  for (const name of ['e2e-pane-a', 'e2e-pane-b']) {
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  }

  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('section[data-terminal-root="true"]')).toHaveCount(2, { timeout: 5000 });

  await page.getByRole('button', { name: /change layout/i }).click();
  await page.getByRole('menuitemradio', { name: /^Single$/ }).click();

  await expect(page.locator('section[data-terminal-root="true"]')).toHaveCount(1);
});
