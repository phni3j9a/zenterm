import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'screenshots');
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:18765';
const AUTH_TOKEN = process.env.E2E_AUTH_TOKEN ?? '2236';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// -------------------------------------------------------
// TC-01: Login page loads correctly
// -------------------------------------------------------
test('TC-01: Login page is displayed', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto(BASE_URL + '/app/login');

  // Login page should be visible
  await expect(page.locator('[data-testid="login-page"]')).toBeVisible();

  // Token input and submit button should exist
  await expect(page.locator('input#token')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-login-page.png') });

  if (consoleErrors.length > 0) {
    console.log('Console errors detected:', consoleErrors);
  }
});

// -------------------------------------------------------
// TC-02: Wrong token shows error
// -------------------------------------------------------
test('TC-02: Wrong token shows authentication error', async ({ page }) => {
  await page.goto(BASE_URL + '/app/login');

  await page.fill('input#token', 'wrong-token');
  await page.click('button[type="submit"]');

  // Error message should appear
  const errorEl = page.locator('[data-testid="login-error"]');
  await expect(errorEl).toBeVisible({ timeout: 10_000 });
  await expect(errorEl).toContainText('Authentication failed');

  // Should still be on login page
  await expect(page.locator('[data-testid="login-page"]')).toBeVisible();

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-login-failure.png') });
});

// -------------------------------------------------------
// TC-03: Correct token navigates to main page
// -------------------------------------------------------
test('TC-03: Correct token navigates to main page', async ({ page }) => {
  await page.goto(BASE_URL + '/app/login');

  await page.fill('input#token', AUTH_TOKEN);
  await page.click('button[type="submit"]');

  // Should navigate to main layout
  await expect(page.locator('[data-testid="main-layout"]')).toBeVisible({ timeout: 10_000 });

  // Login page should not be visible
  await expect(page.locator('[data-testid="login-page"]')).not.toBeVisible();

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-main-page.png') });
});

// -------------------------------------------------------
// TC-04: Auth API direct test
// -------------------------------------------------------
test('TC-04: POST /api/auth/verify — correct token returns 200, wrong returns 401', async ({ request }) => {
  const okResp = await request.post(BASE_URL + '/api/auth/verify', {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
  });
  expect(okResp.status()).toBe(200);

  const ngResp = await request.post(BASE_URL + '/api/auth/verify', {
    headers: { Authorization: 'Bearer wrongtoken' },
  });
  expect(ngResp.status()).toBe(401);
});

// -------------------------------------------------------
// TC-05: Health endpoint
// -------------------------------------------------------
test('TC-05: GET /health returns 200 with { ok: true }', async ({ request }) => {
  const resp = await request.get(BASE_URL + '/health');
  expect(resp.status()).toBe(200);

  const body = await resp.json();
  expect(body).toEqual({ ok: true });
});
