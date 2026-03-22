import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'screenshots');
const BASE_URL = 'http://localhost:18765';
const AUTH_TOKEN = '2236';
const WRONG_TOKEN = '9999';

// スクリーンショット保存ディレクトリを作成
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// -------------------------------------------------------
// TC-01: ページ読み込み — ログイン画面が表示されること
// -------------------------------------------------------
test('TC-01: ページ読み込み — ログイン画面が表示される', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto(BASE_URL + '/');

  // #login-view が active クラスを持ち表示されている
  const loginView = page.locator('#login-view');
  await expect(loginView).toBeVisible();
  await expect(loginView).toHaveClass(/active/);

  // #token-input と #login-btn が存在する
  await expect(page.locator('#token-input')).toBeVisible();
  await expect(page.locator('#login-btn')).toBeVisible();

  // ダッシュボードは非表示
  const dashView = page.locator('#dashboard-view');
  await expect(dashView).not.toHaveClass(/active/);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-login-page.png') });

  if (consoleErrors.length > 0) {
    console.log('Console errors detected:', consoleErrors);
  }
});

// -------------------------------------------------------
// TC-02: 間違ったトークンでログイン失敗
// -------------------------------------------------------
test('TC-02: 間違ったトークン — 認証失敗エラーが表示される', async ({ page }) => {
  await page.goto(BASE_URL + '/');

  await page.fill('#token-input', WRONG_TOKEN);
  await page.click('#login-btn');

  // エラーメッセージが表示されるまで待つ
  const loginError = page.locator('#login-error');
  await expect(loginError).toBeVisible({ timeout: 10_000 });
  await expect(loginError).toContainText('認証に失敗しました');

  // ログイン画面は継続表示
  await expect(page.locator('#login-view')).toHaveClass(/active/);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-login-failure.png') });
});

// -------------------------------------------------------
// TC-03: 正しいトークンでログイン成功 — ダッシュボードに遷移
// -------------------------------------------------------
test('TC-03: 正しいトークン — ダッシュボード画面に遷移する', async ({ page }) => {
  await page.goto(BASE_URL + '/');

  await page.fill('#token-input', AUTH_TOKEN);
  await page.click('#login-btn');

  // ダッシュボードが active になるまで待つ
  const dashView = page.locator('#dashboard-view');
  await expect(dashView).toHaveClass(/active/, { timeout: 10_000 });

  // ログイン画面は非表示になる
  const loginView = page.locator('#login-view');
  await expect(loginView).not.toHaveClass(/active/);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-dashboard.png') });
});

// -------------------------------------------------------
// TC-04: 認証API直接テスト
// -------------------------------------------------------
test('TC-04: POST /api/auth/verify — Bearer 2236 は 200、wrong は 401', async ({ request }) => {
  // 正しいトークン → 200
  const okResp = await request.post(BASE_URL + '/api/auth/verify', {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
  });
  expect(okResp.status()).toBe(200);

  // 間違ったトークン → 401
  const ngResp = await request.post(BASE_URL + '/api/auth/verify', {
    headers: { Authorization: 'Bearer wrongtoken' },
  });
  expect(ngResp.status()).toBe(401);
});

// -------------------------------------------------------
// TC-05: health エンドポイント — 認証なしで 200
// -------------------------------------------------------
test('TC-05: GET /health — トークンなしで 200 が返る', async ({ request }) => {
  const resp = await request.get(BASE_URL + '/health');
  expect(resp.status()).toBe(200);

  const body = await resp.json();
  expect(body).toHaveProperty('ok', true);
});
