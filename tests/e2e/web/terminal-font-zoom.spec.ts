import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createGatewayEnv, fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4810';
const PORT = 18810;
test.beforeAll(async () => {
  const { env } = createGatewayEnv({ port: PORT, token: TOKEN, label: 'zenterm-term-fontzoom' });
  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env,
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
    await fetch(`${baseUrl}/api/sessions/e2e-zoom`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  } catch { /* ignore */ }
  gateway?.kill();
});

test('header +/− and Ctrl+=/Ctrl+0 control font size', async ({ page }) => {
  const created = await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'e2e-zoom' }),
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
  await page.getByText('e2e-zoom').click();
  await expect(page.getByLabel(/Connection Connected/i)).toBeVisible({ timeout: 5000 });

  // The reset button shows the current font size as its label text.
  const reset = page.getByRole('button', { name: /^Reset font size$/ });
  await expect(reset).toHaveText(/14/);

  await page.getByRole('button', { name: /^Increase font size$/ }).click();
  await expect(reset).toHaveText(/15/);

  await page.getByRole('button', { name: /^Decrease font size$/ }).click();
  await expect(reset).toHaveText(/14/);

  // Use Ctrl+= via keyboard inside xterm.
  await page.locator('.xterm-helper-textarea').focus();
  await page.keyboard.down('Control');
  await page.keyboard.press('=');
  await page.keyboard.up('Control');
  await expect(reset).toHaveText(/15/);

  // Ctrl+0 resets to 14.
  await page.keyboard.down('Control');
  await page.keyboard.press('0');
  await page.keyboard.up('Control');
  await expect(reset).toHaveText(/14/);
});
