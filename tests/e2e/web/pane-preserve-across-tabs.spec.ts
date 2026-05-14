import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createGatewayEnv, fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4813';
const PORT = 18813;

test.beforeAll(async () => {
  const { env } = createGatewayEnv({
    port: PORT,
    token: TOKEN,
    label: 'zenterm-pane-preserve',
  });
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

test('2 ペイン構成は files/settings タブを巡回しても保持される', async ({ page }) => {
  // Pre-create two sessions via API so they're available in the sidebar.
  for (const name of ['e2e-preserve-a', 'e2e-preserve-b']) {
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
  await fillOtp(page, TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  // Step 1: Open the first session as a single pane.
  await page.getByText('e2e-preserve-a').click();
  await expect(page.getByLabel(/Connection Connected/i)).toBeVisible({ timeout: 5000 });

  // Step 2: Switch to cols-2 layout.
  await page.getByRole('button', { name: /change layout/i }).click();
  await page.getByRole('menuitemradio', { name: /2 cols/i }).click();

  // Step 3: Focus the empty pane and assign the 2nd session.
  const emptyPane = page.getByText(/Choose one from the sidebar/i);
  await expect(emptyPane).toBeVisible({ timeout: 5000 });
  await emptyPane.click();
  await page.getByText('e2e-preserve-b').click();

  // Step 4: Confirm 2 panes are present, both connected.
  await expect(page.locator('section[data-terminal-root="true"]')).toHaveCount(2, {
    timeout: 10000,
  });
  await expect(page.getByLabel(/Connection Connected/i).nth(1)).toBeVisible({ timeout: 5000 });

  // Step 5: Move to the files tab → 2 panes must still be mounted (preserved).
  await page.getByRole('tab', { name: /^files$/i }).click();
  await expect(page).toHaveURL(/\/web\/files(?:[?#]|$)/);
  await expect(page.locator('section[data-terminal-root="true"]')).toHaveCount(2);

  // Step 6: Move to the settings tab → still preserved.
  await page.getByRole('tab', { name: /^settings$/i }).click();
  await expect(page).toHaveURL(/\/web\/settings(?:[?#]|$)/);
  await expect(page.locator('section[data-terminal-root="true"]')).toHaveCount(2);

  // Step 7: Return to sessions tab → still preserved.
  // The sessions URL is augmented with a `#l=...&p=...` hash that encodes the
  // current layout + pane assignments, so we only check the path prefix.
  await page.getByRole('tab', { name: /^sessions$/i }).click();
  await expect(page).toHaveURL(/\/web\/sessions(?:[?#]|$)/);
  await expect(page.locator('section[data-terminal-root="true"]')).toHaveCount(2);
  await expect(page.getByLabel(/Connection Connected/i)).toHaveCount(2);
});
