import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4813';
const PORT = 18813;

test.beforeAll(async () => {
  const home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(
    join(home, '.config', 'zenterm', '.env'),
    `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`,
  );
  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: { ...process.env, HOME: home, PORT: String(PORT), HOST: '127.0.0.1', AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error' },
    stdio: 'inherit',
  });
  baseUrl = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${baseUrl}/health`);
      if (r.ok) return;
    } catch { /* ignore */ }
    await new Promise((res) => setTimeout(res, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(async () => {
  gateway?.kill();
});

async function loginAndWait(page: Page, path = '/web') {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'dark', language: 'en', fontSize: 14, autoCopyOnSelect: false },
      version: 2,
    }));
  });
  await page.goto(`${baseUrl}${path}`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Sidebar 表示確認
  await expect(page.locator('aside[role="complementary"]')).toBeVisible({ timeout: 5000 });
}

test('Sidebar drag resizer changes width and persists across reload', async ({ page }) => {
  await loginAndWait(page);
  const aside = page.locator('aside[role="complementary"]');
  await expect(aside).toBeVisible();
  // 初期幅 320
  const initial = await aside.boundingBox();
  expect(initial?.width).toBeCloseTo(320, 0);

  const handle = page.getByRole('separator', { name: /resize/i });
  await expect(handle).toBeVisible();
  // フォーカスしてキーボード操作で幅を変更 (ArrowRight = +16px ずつ)
  await handle.focus();
  // 5回 ArrowRight: +80px → 400px
  for (let i = 0; i < 5; i++) {
    await handle.press('ArrowRight');
  }

  const after = await aside.boundingBox();
  expect(after?.width).toBeGreaterThan(380);
  expect(after?.width).toBeLessThanOrEqual(420);
  const newWidth = after?.width ?? 0;

  // reload して幅が永続化されてるか確認
  // Auth token は localStorage に persist されているため reload 後はログインフォームが出ない
  await page.reload();
  await expect(page.locator('aside[role="complementary"]')).toBeVisible({ timeout: 5000 });
  const reloaded = await page.locator('aside[role="complementary"]').boundingBox();
  // ±1px tolerance (round)
  expect(Math.abs((reloaded?.width ?? 0) - newWidth)).toBeLessThanOrEqual(2);
});

test('deep link /web/sessions/:id navigates without crash', async ({ page }) => {
  // ※ 既存セッションが必須ではない。session が無くても URL parser がクラッシュしない + Sidebar が表示される、というスモークテスト。
  // ログイン後は /web/sessions にリダイレクトされる (Phase 5 で redirect 先 preserve を実装予定)。
  // ここでは: アプリがクラッシュせず Sidebar が表示されることを確認する。
  await loginAndWait(page, '/web/sessions/ghost');
  // Sidebar が正常に表示される (クラッシュしていない証明)
  await expect(page.locator('aside[role="complementary"]')).toBeVisible();
  // /web/sessions 配下の URL であること (ghost が存在しないため /web/sessions にフォールバック)
  expect(page.url()).toContain('/web/sessions');
});
