/**
 * Phase 6 H12 E2E — reduced-motion + zen-spin keyframe verification.
 *
 * Verifies that:
 *   1. The zen-spin keyframe CSS rule is present in the loaded stylesheet.
 *   2. A prefers-reduced-motion media block that overrides zen-spin is present.
 *   3. The .zen-fade transition utility classes are also present.
 *
 * Gateway port 18818, token 4818.
 */
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createGatewayEnv } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4818';
const PORT = 18818;

test.beforeAll(async () => {
  const { env } = createGatewayEnv({ port: PORT, token: TOKEN, label: 'zenterm-p6-motion' });
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

/**
 * Collect all CSS text from the page's loaded stylesheets (same-origin only).
 */
async function getAllCssText(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const parts: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          parts.push(rule.cssText);
        }
      } catch {
        // cross-origin sheets are inaccessible; skip
      }
    }
    return parts.join('\n');
  });
}

test('zen-spin base keyframe is present in stylesheet', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}/web/login`);
  await page.waitForLoadState('networkidle');

  const css = await getAllCssText(page);
  expect(css).toContain('zen-spin');
  await ctx.close();
});

test('reduced-motion media block overrides zen-spin to static', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}/web/login`);
  await page.waitForLoadState('networkidle');

  const css = await getAllCssText(page);
  // The reduced-motion block overrides zen-spin
  expect(css).toContain('prefers-reduced-motion');
  expect(css).toContain('zen-spin');
  // The override sets transform to none
  expect(css).toContain('transform: none');

  await ctx.close();
});

test('zen-fade utility classes are present in stylesheet', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}/web/login`);
  await page.waitForLoadState('networkidle');

  const css = await getAllCssText(page);
  expect(css).toContain('zen-fade-enter');
  expect(css).toContain('zen-fade-leave');
  expect(css).toContain('opacity: 1');
  expect(css).toContain('opacity: 0');
  await ctx.close();
});

test('reduced-motion disables zen-fade transitions', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}/web/login`);
  await page.waitForLoadState('networkidle');

  // Under reduced-motion, .zen-fade-enter-active should report 0s transition duration
  const transitionDuration = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'zen-fade-enter-active';
    document.body.appendChild(el);
    const duration = getComputedStyle(el).transitionDuration;
    el.remove();
    return duration;
  });
  // 'none' transition => duration is '0s'
  expect(transitionDuration).toBe('0s');

  await ctx.close();
});
