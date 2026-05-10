import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4793';
const PORT = 18793;

test.beforeAll(async () => {
  const home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(join(home, '.config', 'zenterm', '.env'), `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`);

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: { ...process.env, HOME: home, PORT: String(PORT), HOST: '127.0.0.1', AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error' },
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

test('font size increases and persists across reload', async ({ page }) => {
  // Set localStorage directly before first navigation:
  // - language: en (for stable English assertions)
  // - fontSize: 14 (reset to default so test is predictable)
  // - Preserve fontSize on reload by not resetting to 14 once it's been set > 14
  await page.addInitScript(() => {
    const raw = localStorage.getItem('zenterm-web-settings');
    if (!raw) {
      // Fresh browser — set defaults
      localStorage.setItem('zenterm-web-settings', JSON.stringify({
        state: { themeMode: 'system', language: 'en', fontSize: 14 }, version: 1,
      }));
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { state: { themeMode: string; language: string; fontSize: number }; version: number };
      // Always force English
      parsed.state.language = 'en';
      // If fontSize hasn't been intentionally increased above default (i.e. this is first load
      // or we're re-running after a failed test), reset to 14 to start predictably.
      // After the user clicks +2 the stored value will be 16; on reload we must NOT reset it.
      // We use a session marker to distinguish first navigation from reload.
      const marker = sessionStorage.getItem('__e2e_fontsize_set');
      if (!marker) {
        parsed.state.fontSize = 14;
      }
      localStorage.setItem('zenterm-web-settings', JSON.stringify(parsed));
    } catch {
      // ignore parse errors
    }
  });

  // Login
  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  // Navigate to Settings
  await page.getByRole('button', { name: /settings tab/i }).click();
  await expect(page).toHaveURL(/\/web\/settings$/);

  // Click "Increase font size" twice (14 → 16)
  await page.getByRole('button', { name: /increase font size/i }).click();
  await page.getByRole('button', { name: /increase font size/i }).click();

  // Mark in sessionStorage that fontSize has been intentionally changed (survives page.reload())
  await page.evaluate(() => sessionStorage.setItem('__e2e_fontsize_set', '1'));

  // Assert localStorage has fontSize: 16
  const storedAfterIncrease = await page.evaluate(() => localStorage.getItem('zenterm-web-settings'));
  expect(storedAfterIncrease).toContain('"fontSize":16');

  // Reload the page (init script sees sessionStorage marker and preserves fontSize=16)
  await page.reload();

  // Verify font size is still 16 after reload (check localStorage)
  await expect(page).toHaveURL(/\/web\/settings$/);
  const storedAfterReload = await page.evaluate(() => localStorage.getItem('zenterm-web-settings'));
  expect(storedAfterReload).toContain('"fontSize":16');
});
