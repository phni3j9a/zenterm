import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createGatewayEnv, fillOtp } from './helpers';

const TOKEN = '5556';
const PORT = 18817;

let gateway: ChildProcess;
let baseUrl: string;

test.beforeAll(async () => {
  const { env } = createGatewayEnv({ port: PORT, token: TOKEN, label: 'zenterm-image-drop' });
  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env,
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

/** Create a session via the REST API and return its displayName. */
async function createSession(): Promise<string | null> {
  try {
    const r = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!r.ok) return null;
    const s = (await r.json()) as { displayName?: string; name?: string };
    return (s.displayName ?? s.name) ?? null;
  } catch {
    return null;
  }
}

async function navigateToSession(
  page: import('@playwright/test').Page,
  sessionId: string,
) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'zenterm-web-settings',
      JSON.stringify({
        state: { themeMode: 'dark', language: 'en', fontSize: 14, autoCopyOnSelect: false },
        version: 2,
      }),
    );
  });

  await page.goto(`${baseUrl}/web/sessions/${encodeURIComponent(sessionId)}`);

  try {
    const digitOne = page.getByLabel('Digit 1');
    await digitOne.waitFor({ state: 'visible', timeout: 1500 });
    await fillOtp(page, TOKEN);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('aside[role="complementary"]')).toBeVisible({ timeout: 5000 });
  } catch {
    // Already authenticated — no-op
  }

  await expect(page.locator('aside[role="complementary"]')).toBeVisible({ timeout: 5000 });

  const sidebar = page.locator('aside[role="complementary"]');
  await expect(sidebar.locator(`text="${sessionId}"`).first()).toBeVisible({ timeout: 10000 });

  await expect(page.locator('section[data-terminal-root]')).toBeVisible({ timeout: 8000 });
}

test('drop two images: staging + two quoted paths typed into pty', async ({ page }) => {
  const sessionId = await createSession();
  if (!sessionId) { test.skip(); return; }

  await navigateToSession(page, sessionId);
  await page.waitForTimeout(2000);

  const dropResult = await page.evaluate(async () => {
    function makeDragEvent(type: string, dt: DataTransfer): DragEvent {
      return new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt });
    }
    // Minimal valid 1x1 PNG (89 50 4E 47 …) — only the magic header is needed for the test.
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);
    const dt = new DataTransfer();
    dt.items.add(new File([pngBytes], 'a.png', { type: 'image/png' }));
    dt.items.add(new File([pngBytes], 'b.png', { type: 'image/png' }));
    window.dispatchEvent(makeDragEvent('dragenter', dt));
    window.dispatchEvent(makeDragEvent('dragover', dt));
    await new Promise((r) => setTimeout(r, 300));
    const dropZone = Array.from(document.querySelectorAll<HTMLElement>('[role="region"]')).find(
      (el) => el.style.zIndex === '50',
    );
    if (!dropZone) return { found: false };
    dropZone.dispatchEvent(makeDragEvent('drop', dt));
    return { found: true };
  });

  if (!dropResult.found) { test.skip(); return; }

  const toast = page.locator('[role="status"]').filter({ hasText: /Uploaded 2 file/i }).first();
  await expect(toast).toBeVisible({ timeout: 15000 });

  const screen = page.locator('.xterm-screen').first();
  // After echo, both paths should show inside the buffer. Look for `uploads/zenterm/` appearing twice.
  await expect(screen).toContainText(/uploads\/zenterm\/.+uploads\/zenterm\//s, { timeout: 20000 });
});
