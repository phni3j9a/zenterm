import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createGatewayEnv, fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4808';
const PORT = 18808;
let gatewayEnv: NodeJS.ProcessEnv;

async function startGateway(): Promise<void> {
  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: gatewayEnv,
    stdio: 'inherit',
  });
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
}

test.beforeAll(async () => {
  ({ env: gatewayEnv } = createGatewayEnv({ port: PORT, token: TOKEN, label: 'zenterm-term-reconnect' }));
  baseUrl = `http://127.0.0.1:${PORT}`;
  await startGateway();
});

test.afterAll(async () => {
  try {
    await fetch(`${baseUrl}/api/sessions/e2e-rec`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  } catch { /* ignore */ }
  gateway?.kill();
});

test('Reconnect button reconnects after WS is dropped', async ({ page }) => {
  const created = await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'e2e-rec' }),
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

  await page.getByText('e2e-rec').click();
  await expect(page.getByLabel(/Connection Connected/i)).toBeVisible({ timeout: 5000 });

  // Force-drop the WS by killing & restarting the gateway.
  gateway?.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 1500));

  // Status should leave 'Connected' (becomes 'Reconnecting…' or 'Disconnected').
  await expect(page.getByLabel(/Connection Connected/i)).toBeHidden({ timeout: 10000 });

  // Restart the gateway so the reconnect can succeed.
  await startGateway();

  // Click the Reconnect button (skip backoff wait).
  const reconnectBtn = page.getByRole('button', { name: /^Reconnect$/ });
  await expect(reconnectBtn).toBeVisible({ timeout: 5000 });
  await reconnectBtn.click();

  // Eventually returns to Connected.
  await expect(page.getByLabel(/Connection Connected/i)).toBeVisible({ timeout: 10000 });
});
