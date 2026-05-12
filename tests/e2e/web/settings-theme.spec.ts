import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createGatewayEnv, fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4791';
const PORT = 18791;

test.beforeAll(async () => {
  const { env } = createGatewayEnv({ port: PORT, token: TOKEN, label: 'zenterm-settings-theme' });
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

test('theme toggle persists across reload', async ({ page }) => {
  // Force English locale (do NOT preset themeMode so we can test its persistence)
  await page.addInitScript(() => {
    const raw = localStorage.getItem('zenterm-web-settings');
    if (!raw) {
      // Only set defaults if nothing is stored yet — preserves any themeMode written by the test
      localStorage.setItem('zenterm-web-settings', JSON.stringify({
        state: { themeMode: 'system', language: 'en', fontSize: 14 }, version: 1,
      }));
    } else {
      // Keep existing themeMode but ensure language is English
      try {
        const parsed = JSON.parse(raw) as { state: { themeMode: string; language: string; fontSize: number }; version: number };
        parsed.state.language = 'en';
        localStorage.setItem('zenterm-web-settings', JSON.stringify(parsed));
      } catch {
        // ignore parse errors
      }
    }
  });

  // Login
  await page.goto(`${baseUrl}/web`);
  await fillOtp(page, TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  // Navigate to Settings (Phase 6 G5: LeftRail uses role="tab")
  await page.getByRole('tab', { name: /^settings$/i }).click();
  await expect(page).toHaveURL(/\/web\/settings$/);

  // Click Light button
  await page.getByRole('button', { name: /light/i }).click();

  // Verify localStorage has themeMode: light
  const stored = await page.evaluate(() => localStorage.getItem('zenterm-web-settings'));
  expect(stored).not.toBeNull();
  expect(stored).toContain('"themeMode":"light"');

  // Reload the page (init script preserves the stored themeMode on reload)
  await page.reload();

  // Verify Settings tab is still selected and Light button is still pressed
  await expect(page).toHaveURL(/\/web\/settings$/);
  const lightBtn = page.getByRole('button', { name: /light/i });
  await expect(lightBtn).toHaveAttribute('aria-pressed', 'true');
});
