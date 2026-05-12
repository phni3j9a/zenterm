import type { Page } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Fill the OTP login form by entering each digit into its individual input box.
 * Replaces the old single-input approach after the Phase 6 G4 login redesign.
 */
export async function fillOtp(page: Page, token: string): Promise<void> {
  const digits = token.split('');
  for (let i = 0; i < digits.length; i++) {
    await page.getByLabel(`Digit ${i + 1}`).fill(digits[i]);
  }
}

export interface GatewayEnvOptions {
  port: number;
  token: string;
  host?: string;
  logLevel?: string;
  /** Prefix used for the mkdtemp directories so leftover dirs in /tmp are searchable. */
  label?: string;
}

export interface GatewayEnvResult {
  home: string;
  tmuxTmpdir: string;
  env: NodeJS.ProcessEnv;
}

/**
 * Creates a fully isolated env block for spawning the gateway in an e2e spec.
 *
 * CRITICAL: TMUX_TMPDIR is set to its own mkdtemp directory so the gateway's
 * tmux child processes use a per-spec tmux server at $TMUX_TMPDIR/tmux-<euid>/default
 * instead of the user's default socket at /tmp/tmux-<euid>/default. Without this,
 * a flaky e2e run can take down the developer's working tmux sessions.
 *
 * Also writes the gateway's .env file inside the fresh HOME so AUTH_TOKEN/PORT
 * are picked up.
 */
export function createGatewayEnv(opts: GatewayEnvOptions): GatewayEnvResult {
  const label = opts.label ?? 'zenterm-e2e';
  const home = mkdtempSync(join(tmpdir(), `${label}-home-`));
  const tmuxTmpdir = mkdtempSync(join(tmpdir(), `${label}-tmux-`));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(
    join(home, '.config', 'zenterm', '.env'),
    `AUTH_TOKEN=${opts.token}\nPORT=${opts.port}\nHOST=${opts.host ?? '127.0.0.1'}\n`,
  );
  return {
    home,
    tmuxTmpdir,
    env: {
      ...process.env,
      HOME: home,
      TMUX_TMPDIR: tmuxTmpdir,
      PORT: String(opts.port),
      HOST: opts.host ?? '127.0.0.1',
      AUTH_TOKEN: opts.token,
      LOG_LEVEL: opts.logLevel ?? 'error',
    },
  };
}
