# ZenTerm PC Web Phase 1 (Bootstrap) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open Gateway's `/web` URL → enter 4-digit token → see sessions list → click a session → working terminal renders in browser via xterm.js.

**Architecture:** Add `/web/*` route to Fastify gateway that serves a new React SPA built from `server/packages/web`. SPA mounts xterm.js directly (no iframe), uses existing `/api/*` and `/ws/*` endpoints, persists token in localStorage, follows iPad regular layout pattern (Sidebar + TerminalPane) but limited to single pane in this phase.

**Tech Stack:** TypeScript 5.7 / React 19 / Vite 6 / zustand / react-router 6 / xterm.js v6 (with addons fit, unicode11, web-links) / Vitest + React Testing Library / Playwright.

**Reference Spec:** `server/docs/superpowers/specs/2026-05-09-pc-web-design.md`

---

## File Structure

### Gateway side (existing, modify)

| File | Change |
|---|---|
| `server/packages/gateway/src/index.ts` | Extend `showPairingInfo()` to print Web URL lines |
| `server/packages/gateway/src/cli.ts` | Add `info` and `qr` subcommands |
| `server/packages/gateway/src/app.ts` | Register new `webRoutes` |
| `server/packages/gateway/package.json` | (no change) |

### Gateway side (new)

| File | Responsibility |
|---|---|
| `server/packages/gateway/src/routes/web.ts` | SPA fallback: serve `public/web/index.html` for `/web` and `/web/*`, serve `public/web/assets/*` |
| `server/packages/gateway/src/__tests__/routes/web.test.ts` | Tests for /web routes |

### Web package (new — `server/packages/web/`)

| File | Responsibility |
|---|---|
| `package.json` | Dependencies + scripts |
| `tsconfig.json` | TS config (extends root) |
| `vite.config.ts` | Build config (output to `../gateway/public/web`) |
| `vitest.config.ts` | Test config (jsdom env, RTL setup) |
| `index.html` | Vite entry |
| `src/main.tsx` | React root mount |
| `src/App.tsx` | Top-level router shell |
| `src/setupTests.ts` | RTL global setup |
| `src/theme/tokens.ts` | colors / spacing / typography (port from `app/src/theme/tokens.ts`) |
| `src/theme/terminalColors.ts` | ANSI palette (port from `embed/terminal/index.html`) |
| `src/theme/index.ts` | useTheme hook |
| `src/stores/auth.ts` | zustand store: `{ token, gatewayUrl }`, persist |
| `src/stores/sessions.ts` | zustand store: `{ sessions, loading, error }` |
| `src/api/client.ts` | REST client (verify, listSessions, listWindows) |
| `src/api/errors.ts` | HttpError class |
| `src/lib/terminalProtocol.ts` | WS message helpers (encode/decode) |
| `src/lib/imeDedup.ts` | IME 100ms dedup logic |
| `src/lib/reconnectBackoff.ts` | Exponential backoff state machine |
| `src/components/LoginForm.tsx` | 4-digit token input form |
| `src/components/Sidebar.tsx` | Left rail (sessions list only in Phase 1) |
| `src/components/SessionsListPanel.tsx` | Sessions list with expand/window rows |
| `src/components/TerminalPane.tsx` | Right area with toolbar + XtermView |
| `src/components/terminal/XtermView.tsx` | xterm.js mount + WS wiring |
| `src/routes/login.tsx` | Renders LoginForm; on success, navigate to /web/sessions |
| `src/routes/sessions.tsx` | Sidebar + TerminalPane |
| `src/__tests__/...` | Unit + component tests, co-located by feature |

### E2E (extends existing Playwright suite)

| File | Responsibility |
|---|---|
| `server/tests/e2e/web/login.spec.ts` | E2E: open /web → login form → enter token → /web/sessions |
| `server/tests/e2e/web/terminal.spec.ts` | E2E: from sessions, click → terminal opens, type `echo hi`, see output |

---

## Phase 1A: Gateway Pairing Display (3 tasks)

### Task 1: Extract `formatPairingInfo()` from `showPairingInfo()`

**Files:**
- Modify: `server/packages/gateway/src/index.ts`
- Test: `server/packages/gateway/src/__tests__/pairing-info.test.ts` (new)

- [ ] **Step 1: Write failing test for `formatPairingInfo()`**

Create `server/packages/gateway/src/__tests__/pairing-info.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatPairingInfo } from '../index.js';

describe('formatPairingInfo', () => {
  it('includes LAN, Tailscale, Web URLs and Token', () => {
    const lines = formatPairingInfo({
      lan: '10.0.0.5',
      tailscale: '100.10.20.30',
      port: 18765,
      token: '1234',
    });
    expect(lines).toContain('  LAN:       http://10.0.0.5:18765');
    expect(lines).toContain('  Web (LAN): http://10.0.0.5:18765/web');
    expect(lines).toContain('  Tailscale: http://100.10.20.30:18765');
    expect(lines).toContain('  Web (Ts):  http://100.10.20.30:18765/web');
    expect(lines).toContain('  Token:     1234');
  });

  it('omits Tailscale lines when tailscale missing', () => {
    const lines = formatPairingInfo({
      lan: '10.0.0.5',
      tailscale: null,
      port: 18765,
      token: '1234',
    });
    expect(lines.some((l) => l.includes('Tailscale'))).toBe(false);
    expect(lines.some((l) => l.includes('Web (Ts)'))).toBe(false);
  });

  it('omits LAN lines when lan missing', () => {
    const lines = formatPairingInfo({
      lan: null,
      tailscale: '100.10.20.30',
      port: 18765,
      token: '1234',
    });
    expect(lines.some((l) => l.includes('  LAN:'))).toBe(false);
    expect(lines.some((l) => l.includes('Web (LAN)'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/gateway && npx vitest run pairing-info
```

Expected: FAIL with `formatPairingInfo is not exported from ../index.js`

- [ ] **Step 3: Refactor `showPairingInfo()` to use exported `formatPairingInfo()`**

Modify `server/packages/gateway/src/index.ts`. Find the existing `showPairingInfo()` function and replace it with:

```ts
export interface PairingInfoInput {
  lan: string | null;
  tailscale: string | null;
  port: number;
  token: string;
}

export function formatPairingInfo(input: PairingInfoInput): string[] {
  const { lan, tailscale, port, token } = input;
  const lines: string[] = [];
  if (lan) {
    lines.push(`  LAN:       http://${lan}:${port}`);
    lines.push(`  Web (LAN): http://${lan}:${port}/web`);
  }
  if (tailscale) {
    lines.push(`  Tailscale: http://${tailscale}:${port}`);
    lines.push(`  Web (Ts):  http://${tailscale}:${port}/web`);
  }
  lines.push(`  Token:     ${token}`);
  return lines;
}

function showPairingInfo(): void {
  const { lan, tailscale } = getNetworkAddresses();

  if (!lan && !tailscale) {
    app.log.warn('ネットワークアドレスを検出できませんでした。');
    return;
  }

  const primaryIp = lan ?? tailscale!;
  const primaryUrl = `http://${primaryIp}:${config.PORT}`;
  const pairingUrl = `zenterm://connect?url=${encodeURIComponent(primaryUrl)}&token=${encodeURIComponent(config.AUTH_TOKEN)}`;

  console.log('');
  console.log('--- zenterm gateway ---');
  for (const line of formatPairingInfo({
    lan,
    tailscale,
    port: config.PORT,
    token: config.AUTH_TOKEN,
  })) {
    console.log(line);
  }
  console.log('');

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const qr = require('qrcode-terminal') as { generate: (text: string, opts: { small: boolean }, cb: (code: string) => void) => void };
    qr.generate(pairingUrl, { small: true }, (code: string) => {
      console.log('  QR コードをモバイルアプリでスキャンしてください:');
      console.log(code);
    });
  } catch {
    console.log(`  Pairing URL: ${pairingUrl}`);
  }

  console.log('---------------------------');
  console.log('');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server/packages/gateway && npx vitest run pairing-info
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Run full test suite to make sure nothing else broke**

```bash
cd server/packages/gateway && npx vitest run
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
cd server
git add packages/gateway/src/index.ts packages/gateway/src/__tests__/pairing-info.test.ts
git commit -m "$(cat <<'EOF'
feat(gateway): extract formatPairingInfo and add Web URL lines

Show /web URL alongside LAN / Tailscale URLs in startup log so users
discover the PC web client without needing /app?token= URLs.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add `zenterm-gateway info` subcommand

**Files:**
- Create: `server/packages/gateway/src/commands/info.ts`
- Modify: `server/packages/gateway/src/cli.ts`
- Test: `server/packages/gateway/src/__tests__/commands/info.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/packages/gateway/src/__tests__/commands/info.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const networkInterfacesMock = vi.hoisted(() => vi.fn());

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    networkInterfaces: networkInterfacesMock,
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync: vi.fn(() => 'AUTH_TOKEN=9876\nPORT=18765\nHOST=0.0.0.0\n'),
    existsSync: vi.fn(() => true),
  };
});

describe('runInfoCommand', () => {
  beforeEach(() => {
    networkInterfacesMock.mockReturnValue({
      en0: [{ family: 'IPv4', address: '192.168.1.42', internal: false }],
      tailscale0: [{ family: 'IPv4', address: '100.50.60.70', internal: false }],
    });
  });

  it('prints LAN, Tailscale, Web URLs and Token from .env', async () => {
    const logs: string[] = [];
    const log = vi.fn((msg?: unknown) => {
      logs.push(String(msg ?? ''));
    });
    const { runInfoCommand } = await import('../../commands/info.js');
    await runInfoCommand({ log });
    const joined = logs.join('\n');
    expect(joined).toContain('http://192.168.1.42:18765');
    expect(joined).toContain('http://192.168.1.42:18765/web');
    expect(joined).toContain('http://100.50.60.70:18765');
    expect(joined).toContain('http://100.50.60.70:18765/web');
    expect(joined).toContain('Token:     9876');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/gateway && npx vitest run commands/info
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement `runInfoCommand`**

Create `server/packages/gateway/src/commands/info.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { formatPairingInfo } from '../index.js';

interface RunInfoOptions {
  log?: (message?: unknown) => void;
}

interface NetworkAddresses {
  lan: string | null;
  tailscale: string | null;
}

function getNetworkAddresses(): NetworkAddresses {
  const result: NetworkAddresses = { lan: null, tailscale: null };
  const interfaces = networkInterfaces();
  for (const [name, entries] of Object.entries(interfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      if (name.startsWith('tailscale') || entry.address.startsWith('100.')) {
        result.tailscale ??= entry.address;
      } else {
        result.lan ??= entry.address;
      }
    }
  }
  return result;
}

interface EnvValues {
  token: string;
  port: number;
}

function readEnvFile(): EnvValues {
  const envPath = join(process.env.HOME ?? '', '.config', 'zenterm', '.env');
  if (!existsSync(envPath)) {
    throw new Error(`設定ファイルが見つかりません: ${envPath}\n  zenterm-gateway setup を実行するか、Gateway を起動してください。`);
  }
  const contents = readFileSync(envPath, 'utf8');
  const envMap = new Map<string, string>();
  for (const line of contents.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) envMap.set(match[1], match[2]);
  }
  const token = envMap.get('AUTH_TOKEN');
  if (!token) throw new Error('AUTH_TOKEN が .env に見つかりません。');
  const port = Number.parseInt(envMap.get('PORT') ?? '18765', 10);
  return { token, port };
}

export async function runInfoCommand(options: RunInfoOptions = {}): Promise<void> {
  const log = options.log ?? console.log;
  const { lan, tailscale } = getNetworkAddresses();
  const { token, port } = readEnvFile();
  log('');
  log('--- zenterm gateway ---');
  for (const line of formatPairingInfo({ lan, tailscale, port, token })) {
    log(line);
  }
  log('---------------------------');
  log('');
}
```

- [ ] **Step 4: Wire up subcommand in `cli.ts`**

Modify `server/packages/gateway/src/cli.ts`. Find the `--help` block and update to mention `info`:

```ts
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Usage: zenterm-gateway [options] [command]

Commands:
  setup        サービス登録 (systemd / launchd)
  info         接続用 URL / Token を再表示
  qr           ペアリング QR コードを再表示

Options:
  --port <number>   ポート番号 (default: 18765)
  --host <string>   バインドアドレス (default: 0.0.0.0)
  -h, --help        ヘルプを表示
  -v, --version     バージョンを表示

Environment:
  PORT              ポート番号
  HOST              バインドアドレス
  AUTH_TOKEN        認証トークン
  LOG_LEVEL         ログレベル (debug, info, warn, error)
`);
  process.exit(0);
}
```

Then immediately after the existing `setup` block (line ~64), add:

```ts
// --- info subcommand ---
if (process.argv[2] === 'info') {
  const { runInfoCommand } = await import('./commands/info.js');
  try {
    await runInfoCommand();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  process.exit(0);
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server/packages/gateway && npx vitest run commands/info
```

Expected: PASS.

- [ ] **Step 6: Manual smoke test**

```bash
cd server/packages/gateway && npm run build && node dist/cli.js info
```

Expected: prints LAN / Web URL / Token from your local `~/.config/zenterm/.env`.

- [ ] **Step 7: Commit**

```bash
cd server
git add packages/gateway/src/commands/info.ts packages/gateway/src/cli.ts packages/gateway/src/__tests__/commands/info.test.ts
git commit -m "$(cat <<'EOF'
feat(gateway): add `info` subcommand to redisplay pairing URLs

Reads ~/.config/zenterm/.env and current network interfaces to rebuild
the pairing info output without needing to restart the daemon.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add `zenterm-gateway qr` subcommand

**Files:**
- Create: `server/packages/gateway/src/commands/qr.ts`
- Modify: `server/packages/gateway/src/cli.ts`
- Test: `server/packages/gateway/src/__tests__/commands/qr.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/packages/gateway/src/__tests__/commands/qr.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const networkInterfacesMock = vi.hoisted(() => vi.fn());
const qrGenerateMock = vi.hoisted(() => vi.fn((text: string, _opts: unknown, cb: (s: string) => void) => cb(`QR(${text})`)));

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, networkInterfaces: networkInterfacesMock };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync: vi.fn(() => 'AUTH_TOKEN=4321\nPORT=18765\n'),
    existsSync: vi.fn(() => true),
  };
});

vi.mock('qrcode-terminal', () => ({
  default: { generate: qrGenerateMock },
  generate: qrGenerateMock,
}));

describe('runQrCommand', () => {
  beforeEach(() => {
    qrGenerateMock.mockClear();
    networkInterfacesMock.mockReturnValue({
      en0: [{ family: 'IPv4', address: '10.0.0.5', internal: false }],
    });
  });

  it('generates QR for zenterm:// URL with LAN address and token', async () => {
    const logs: string[] = [];
    const { runQrCommand } = await import('../../commands/qr.js');
    await runQrCommand({ log: (m) => logs.push(String(m ?? '')) });
    const joined = logs.join('\n');
    expect(qrGenerateMock).toHaveBeenCalled();
    const qrInput = qrGenerateMock.mock.calls[0][0] as string;
    expect(qrInput).toContain('zenterm://connect');
    expect(qrInput).toContain(encodeURIComponent('http://10.0.0.5:18765'));
    expect(qrInput).toContain('token=4321');
    expect(joined).toContain('QR(zenterm://');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/gateway && npx vitest run commands/qr
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement `runQrCommand`**

Create `server/packages/gateway/src/commands/qr.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

interface RunQrOptions {
  log?: (message?: unknown) => void;
}

function getPrimaryAddress(): string | null {
  const interfaces = networkInterfaces();
  let lan: string | null = null;
  let tailscale: string | null = null;
  for (const [name, entries] of Object.entries(interfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      if (name.startsWith('tailscale') || entry.address.startsWith('100.')) {
        tailscale ??= entry.address;
      } else {
        lan ??= entry.address;
      }
    }
  }
  return lan ?? tailscale;
}

function readEnv(): { token: string; port: number } {
  const envPath = join(process.env.HOME ?? '', '.config', 'zenterm', '.env');
  if (!existsSync(envPath)) {
    throw new Error(`設定ファイルが見つかりません: ${envPath}`);
  }
  const contents = readFileSync(envPath, 'utf8');
  const map = new Map<string, string>();
  for (const line of contents.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) map.set(m[1], m[2]);
  }
  const token = map.get('AUTH_TOKEN');
  if (!token) throw new Error('AUTH_TOKEN が .env に見つかりません。');
  return { token, port: Number.parseInt(map.get('PORT') ?? '18765', 10) };
}

export async function runQrCommand(options: RunQrOptions = {}): Promise<void> {
  const log = options.log ?? console.log;
  const ip = getPrimaryAddress();
  if (!ip) {
    throw new Error('ネットワークアドレスを検出できませんでした。');
  }
  const { token, port } = readEnv();
  const url = `http://${ip}:${port}`;
  const pairingUrl = `zenterm://connect?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token)}`;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const qr = require('qrcode-terminal') as { generate: (text: string, opts: { small: boolean }, cb: (code: string) => void) => void };

  await new Promise<void>((resolve) => {
    qr.generate(pairingUrl, { small: true }, (code: string) => {
      log('');
      log('  QR コードをモバイルアプリでスキャンしてください:');
      log(code);
      log(`  Pairing URL: ${pairingUrl}`);
      log('');
      resolve();
    });
  });
}
```

- [ ] **Step 4: Wire up subcommand in `cli.ts`**

Add to `cli.ts` immediately after the `info` subcommand block:

```ts
// --- qr subcommand ---
if (process.argv[2] === 'qr') {
  const { runQrCommand } = await import('./commands/qr.js');
  try {
    await runQrCommand();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  process.exit(0);
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server/packages/gateway && npx vitest run commands/qr
```

Expected: PASS.

- [ ] **Step 6: Manual smoke test**

```bash
cd server/packages/gateway && npm run build && node dist/cli.js qr
```

Expected: QR code printed to terminal.

- [ ] **Step 7: Commit**

```bash
cd server
git add packages/gateway/src/commands/qr.ts packages/gateway/src/cli.ts packages/gateway/src/__tests__/commands/qr.test.ts
git commit -m "$(cat <<'EOF'
feat(gateway): add `qr` subcommand to redisplay pairing QR

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1B: Gateway `/web` Route (2 tasks)

### Task 4: SPA fallback route at `/web/*`

**Files:**
- Create: `server/packages/gateway/src/routes/web.ts`
- Create: `server/packages/gateway/public/web/index.html` (placeholder)
- Modify: `server/packages/gateway/src/app.ts`
- Test: `server/packages/gateway/src/__tests__/routes/web.test.ts`

- [ ] **Step 1: Create placeholder index.html**

Create `server/packages/gateway/public/web/index.html`:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>ZenTerm Web</title>
</head>
<body>
  <div id="root">Web SPA placeholder. Build server/packages/web to replace this file.</div>
</body>
</html>
```

- [ ] **Step 2: Write failing test**

Create `server/packages/gateway/src/__tests__/routes/web.test.ts`:

```ts
process.env.AUTH_TOKEN = 'test-token';
process.env.LOG_LEVEL = 'error';

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

async function buildTestApp(): Promise<FastifyInstance> {
  const { buildApp } = await import('../../app.js');
  const app = await buildApp();
  await app.ready();
  return app;
}

describe('GET /web routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /web returns the SPA index.html', async () => {
    const res = await app.inject({ method: 'GET', url: '/web' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('<div id="root">');
  });

  it('GET /web/sessions also returns index.html (SPA fallback)', async () => {
    const res = await app.inject({ method: 'GET', url: '/web/sessions' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('<div id="root">');
  });

  it('GET /web/sessions/foo/window/0 also returns index.html (SPA fallback)', async () => {
    const res = await app.inject({ method: 'GET', url: '/web/sessions/foo/window/0' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<div id="root">');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd server/packages/gateway && npx vitest run routes/web
```

Expected: FAIL — 404 from gateway.

- [ ] **Step 4: Implement web routes**

Create `server/packages/gateway/src/routes/web.ts`:

```ts
import type { FastifyPluginAsync } from 'fastify';

const webRoutes: FastifyPluginAsync = async (fastify) => {
  // /web → index.html
  fastify.get('/web', async (_request, reply) => {
    reply.type('text/html; charset=utf-8');
    reply.header('Cache-Control', 'no-store');
    return reply.sendFile('web/index.html');
  });

  // /web/* → SPA fallback (any nested path returns index.html for client routing)
  fastify.get('/web/*', async (request, reply) => {
    const path = (request.params as { '*': string })['*'];
    // Don't fallback for /web/assets/* — staticPlugin already serves those
    if (path.startsWith('assets/')) {
      reply.callNotFound();
      return;
    }
    reply.type('text/html; charset=utf-8');
    reply.header('Cache-Control', 'no-store');
    return reply.sendFile('web/index.html');
  });
};

export default webRoutes;
```

- [ ] **Step 5: Register routes in app.ts**

Modify `server/packages/gateway/src/app.ts`. Add import:

```ts
import webRoutes from './routes/web.js';
```

Find the existing `app.register(embedRoutes)` line and add right after:

```ts
  await app.register(webRoutes);
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd server/packages/gateway && npx vitest run routes/web
```

Expected: PASS, 3 tests.

- [ ] **Step 7: Run full test suite**

```bash
cd server/packages/gateway && npx vitest run
```

Expected: all tests pass, no regression.

- [ ] **Step 8: Manual smoke test**

```bash
cd server/packages/gateway && npm run build
AUTH_TOKEN=1234 node dist/index.js &
GATEWAY_PID=$!
sleep 1
curl -s http://localhost:18765/web | head -5
curl -s http://localhost:18765/web/sessions/foo | head -5
kill $GATEWAY_PID
```

Expected: both curl commands return the placeholder index.html.

- [ ] **Step 9: Commit**

```bash
cd server
git add packages/gateway/src/routes/web.ts packages/gateway/src/app.ts packages/gateway/public/web/index.html packages/gateway/src/__tests__/routes/web.test.ts
git commit -m "$(cat <<'EOF'
feat(gateway): add /web SPA fallback route

Returns the SPA index.html for /web and any nested /web/* path so
client-side routing works. /web/assets/* is left to staticPlugin.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Add `info` and `qr` to `--help` and to README

**Files:**
- Modify: `server/README.md` (Quick Start section)

- [ ] **Step 1: Update README**

Modify `server/README.md`. Find the "Quick Start" section and after the "Manual Setup" subsection, add:

```markdown
### Re-displaying connection info

Daemon 稼働中はターミナル出力が見えないため、以下のコマンドで接続情報を再表示できます:

```bash
zenterm-gateway info     # LAN / Tailscale / Web URL / Token を表示
zenterm-gateway qr       # ペアリング用 QR コードを再表示
```

Web ブラウザからアクセスする場合は `Web (LAN)` または `Web (Ts)` の URL を開き、`Token` の 4 桁を入力してください。
```

- [ ] **Step 2: Commit**

```bash
cd server
git add README.md
git commit -m "$(cat <<'EOF'
docs(server): document zenterm-gateway info / qr commands and /web URL

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1C: Web Package Skeleton (5 tasks)

### Task 6: Create `server/packages/web` package.json + tsconfig + vite.config

**Files:**
- Create: `server/packages/web/package.json`
- Create: `server/packages/web/tsconfig.json`
- Create: `server/packages/web/vite.config.ts`
- Create: `server/packages/web/vitest.config.ts`
- Create: `server/packages/web/index.html`
- Create: `server/packages/web/src/setupTests.ts`
- Create: `server/packages/web/.gitignore`
- Modify: `server/package.json` (add web to workspaces, scripts)

- [ ] **Step 1: Create package.json**

Create `server/packages/web/package.json`:

```json
{
  "name": "@zenterm/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "type-check": "tsc -b --noEmit"
  },
  "dependencies": {
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/addon-unicode11": "^0.8.0",
    "@xterm/addon-web-links": "^0.11.0",
    "@xterm/xterm": "^5.5.0",
    "@zenterm/shared": "*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^4.1.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `server/packages/web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create vite.config.ts**

Create `server/packages/web/vite.config.ts`:

```ts
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/web/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../gateway/public/web'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        // Put hashed assets under /web/assets/ so gateway's web.ts SPA fallback
        // can distinguish them from client-routed paths.
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:18765',
      '/ws': { target: 'ws://localhost:18765', ws: true },
    },
  },
});
```

- [ ] **Step 4: Create vitest.config.ts**

Create `server/packages/web/vitest.config.ts`:

```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
    css: true,
  },
});
```

- [ ] **Step 5: Create index.html**

Create `server/packages/web/index.html`:

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/x-icon" href="/web/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ZenTerm</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create setupTests.ts**

Create `server/packages/web/src/setupTests.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 7: Create .gitignore**

Create `server/packages/web/.gitignore`:

```
node_modules
dist
*.log
.DS_Store
```

- [ ] **Step 8: Update root package.json workspaces**

Modify `server/package.json`. Add `packages/web` to workspaces and add scripts:

```json
{
  "name": "zenterm",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "packages/shared",
    "packages/gateway",
    "packages/web"
  ],
  "scripts": {
    "dev:gateway": "npm run dev -w packages/gateway",
    "build:gateway": "npm run build -w packages/gateway",
    "dev:web": "npm run dev -w packages/web",
    "build:web": "npm run build -w packages/web",
    "test:web": "npm run test -w packages/web",
    "sync:pages": "node scripts/sync-pages-from-gateway.mjs",
    "mock:zen-light": "node scripts/generate-zen-light-mockups.mjs"
  },
  "devDependencies": {
    "@playwright/test": "^1.58.2"
  }
}
```

- [ ] **Step 9: Install dependencies**

```bash
cd server && npm install
```

Expected: installs `@zenterm/web` workspace and all deps without errors.

- [ ] **Step 10: Commit (skeleton only — no source yet)**

```bash
cd server
git add packages/web/package.json packages/web/tsconfig.json packages/web/vite.config.ts packages/web/vitest.config.ts packages/web/index.html packages/web/src/setupTests.ts packages/web/.gitignore package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore(web): add packages/web skeleton (Vite + React 19 + TS)

Build output goes to ../gateway/public/web so the gateway can serve it.
Workspace registered at root; dev:web / build:web / test:web scripts added.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Minimal `main.tsx` + `App.tsx` + smoke test

**Files:**
- Create: `server/packages/web/src/main.tsx`
- Create: `server/packages/web/src/App.tsx`
- Create: `server/packages/web/src/__tests__/App.test.tsx`

- [ ] **Step 1: Write failing component test**

Create `server/packages/web/src/__tests__/App.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';

describe('App', () => {
  it('renders ZenTerm heading on root', () => {
    render(
      <MemoryRouter initialEntries={['/web']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /ZenTerm/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/web && npx vitest run App
```

Expected: FAIL — App not exported.

- [ ] **Step 3: Implement minimal App.tsx**

Create `server/packages/web/src/App.tsx`:

```tsx
import { Route, Routes, Navigate } from 'react-router-dom';

function PlaceholderHome() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>ZenTerm</h1>
      <p>Phase 1 bootstrap. Login screen coming next.</p>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/web" element={<PlaceholderHome />} />
      <Route path="/web/*" element={<PlaceholderHome />} />
      <Route path="*" element={<Navigate to="/web" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 4: Implement main.tsx**

Create `server/packages/web/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server/packages/web && npx vitest run App
```

Expected: PASS.

- [ ] **Step 6: Build smoke test**

```bash
cd server/packages/web && npm run build
ls ../gateway/public/web/
```

Expected: `index.html` and `assets/` directory present.

- [ ] **Step 7: Manual integration smoke test**

```bash
cd server/packages/gateway && npm run build && AUTH_TOKEN=1234 node dist/index.js &
GATEWAY_PID=$!
sleep 1
curl -s http://localhost:18765/web | grep -E "(ZenTerm|root)"
kill $GATEWAY_PID
```

Expected: response contains the built index.html (with hashed asset references).

- [ ] **Step 8: Commit**

```bash
cd server
git add packages/web/src/main.tsx packages/web/src/App.tsx packages/web/src/__tests__/App.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): minimal App + main bootstrap with router placeholder

App renders a heading; build outputs to gateway/public/web. End-to-end
HTTP fetch via gateway works.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1D: Theme Tokens & Terminal Colors (2 tasks)

### Task 8: Port design tokens

**Files:**
- Create: `server/packages/web/src/theme/tokens.ts`
- Create: `server/packages/web/src/theme/index.ts`
- Test: `server/packages/web/src/theme/__tests__/tokens.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/packages/web/src/theme/__tests__/tokens.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { darkTokens, lightTokens } from '../tokens';

describe('design tokens', () => {
  it('darkTokens has core color slots', () => {
    expect(darkTokens.colors.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(darkTokens.colors.textPrimary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(darkTokens.colors.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(darkTokens.colors.error).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('lightTokens has same color keys', () => {
    expect(Object.keys(lightTokens.colors).sort()).toEqual(
      Object.keys(darkTokens.colors).sort(),
    );
  });

  it('spacing scale is monotonically increasing', () => {
    const values = [
      darkTokens.spacing.xs,
      darkTokens.spacing.sm,
      darkTokens.spacing.md,
      darkTokens.spacing.lg,
      darkTokens.spacing.xl,
    ];
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/web && npx vitest run theme/tokens
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement tokens.ts**

Create `server/packages/web/src/theme/tokens.ts`:

```ts
// Ported from app/src/theme/tokens.ts (Zen palette).
// Keep keys aligned with the mobile app so designers can port styles.

export interface ColorTokens {
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryMuted: string;
  primarySubtle: string;
  success: string;
  warning: string;
  error: string;
}

export interface ThemeTokens {
  colors: ColorTokens;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    '2xl': number;
    '3xl': number;
    '4xl': number;
  };
  radii: { sm: number; md: number; lg: number };
  typography: {
    bodyMedium: { fontSize: number; lineHeight: number; fontWeight: 500 };
    smallMedium: { fontSize: number; lineHeight: number; fontWeight: 500 };
    small: { fontSize: number; lineHeight: number; fontWeight: 400 };
    caption: { fontSize: number; lineHeight: number; fontWeight: 400 };
    heading: { fontSize: number; lineHeight: number; fontWeight: 600 };
    mono: { fontFamily: string };
  };
}

export const darkTokens: ThemeTokens = {
  colors: {
    bg: '#1B1A17',
    bgElevated: '#211F1B',
    surface: '#26241F',
    surfaceHover: '#302D27',
    border: '#3B3832',
    borderSubtle: '#2A2823',
    textPrimary: '#DBD6C8',
    textSecondary: '#B0AB9B',
    textMuted: '#7E7A6E',
    textInverse: '#1B1A17',
    primary: '#94A687',
    primaryMuted: '#7B8B6F',
    primarySubtle: '#2C3328',
    success: '#94A687',
    warning: '#D4B86A',
    error: '#C46A6A',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 48 },
  radii: { sm: 6, md: 10, lg: 14 },
  typography: {
    bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: 500 },
    smallMedium: { fontSize: 13, lineHeight: 18, fontWeight: 500 },
    small: { fontSize: 12, lineHeight: 16, fontWeight: 400 },
    caption: { fontSize: 11, lineHeight: 14, fontWeight: 400 },
    heading: { fontSize: 18, lineHeight: 24, fontWeight: 600 },
    mono: { fontFamily: '"Noto Sans Mono CJK JP", "Noto Sans Mono", "DejaVu Sans Mono", monospace' },
  },
};

export const lightTokens: ThemeTokens = {
  colors: {
    bg: '#F5F4F0',
    bgElevated: '#FBFAF6',
    surface: '#EFEDE7',
    surfaceHover: '#E5E3DC',
    border: '#CFCBC1',
    borderSubtle: '#DEDBD2',
    textPrimary: '#2A2721',
    textSecondary: '#54504A',
    textMuted: '#8A8478',
    textInverse: '#F5F4F0',
    primary: '#7B8B6F',
    primaryMuted: '#5C6E51',
    primarySubtle: '#E3E8DD',
    success: '#7B8B6F',
    warning: '#B89F56',
    error: '#B25A5A',
  },
  spacing: darkTokens.spacing,
  radii: darkTokens.radii,
  typography: darkTokens.typography,
};
```

- [ ] **Step 4: Implement theme/index.ts**

Create `server/packages/web/src/theme/index.ts`:

```ts
import { useEffect, useState } from 'react';
import { darkTokens, lightTokens, type ThemeTokens } from './tokens';

export type ThemeMode = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'zenterm-theme-mode';

function detectSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useTheme(): { tokens: ThemeTokens; mode: ThemeMode; setMode: (m: ThemeMode) => void } {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';
    return (window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? 'system';
  });
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(detectSystemTheme);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setSystemTheme(mql.matches ? 'light' : 'dark');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, m);
    }
  };

  const effective = mode === 'system' ? systemTheme : mode;
  const tokens = effective === 'light' ? lightTokens : darkTokens;
  return { tokens, mode, setMode };
}

export type { ThemeTokens } from './tokens';
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server/packages/web && npx vitest run theme
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
cd server
git add packages/web/src/theme/
git commit -m "$(cat <<'EOF'
feat(web): add theme tokens (Zen palette dark/light) ported from mobile

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Port terminal ANSI colors

**Files:**
- Create: `server/packages/web/src/theme/terminalColors.ts`
- Test: `server/packages/web/src/theme/__tests__/terminalColors.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/packages/web/src/theme/__tests__/terminalColors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { terminalColorsDark, terminalColorsLight } from '../terminalColors';

describe('terminalColors', () => {
  it('dark theme has all ANSI colors', () => {
    const required = [
      'background', 'foreground', 'cursor', 'cursorAccent', 'selectionBackground',
      'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
      'brightBlack', 'brightRed', 'brightGreen', 'brightYellow',
      'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite',
    ];
    for (const key of required) {
      expect(terminalColorsDark[key as keyof typeof terminalColorsDark]).toBeTruthy();
    }
  });

  it('light theme has same keys as dark', () => {
    expect(Object.keys(terminalColorsLight).sort()).toEqual(
      Object.keys(terminalColorsDark).sort(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/web && npx vitest run theme/terminalColors
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement terminalColors.ts**

Create `server/packages/web/src/theme/terminalColors.ts`:

```ts
// Ported from server/packages/gateway/public/terminal/index.html (themes object).
// Keep these in sync if the embed terminal palette is ever updated.

export interface TerminalColorTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export const terminalColorsDark: TerminalColorTheme = {
  background: '#1B1A17',
  foreground: '#DBD6C8',
  cursor: '#94A687',
  cursorAccent: '#1B1A17',
  selectionBackground: 'rgba(148, 166, 135, 0.25)',
  black: '#1B1A17',
  red: '#C46A6A',
  green: '#94A687',
  yellow: '#D4B86A',
  blue: '#8EB0C4',
  magenta: '#b585b8',
  cyan: '#6fb5b5',
  white: '#c8c3b8',
  brightBlack: '#6D6860',
  brightRed: '#D48080',
  brightGreen: '#A5B59A',
  brightYellow: '#E0C87E',
  brightBlue: '#A0C0D4',
  brightMagenta: '#cda0d0',
  brightCyan: '#88cccc',
  brightWhite: '#F5F2EB',
};

export const terminalColorsLight: TerminalColorTheme = {
  background: '#F5F4F0',
  foreground: '#2A2721',
  cursor: '#7B8B6F',
  cursorAccent: '#F5F4F0',
  selectionBackground: 'rgba(123, 139, 111, 0.18)',
  black: '#2A2721',
  red: '#B25A5A',
  green: '#7B8B6F',
  yellow: '#B89F56',
  blue: '#7A96A8',
  magenta: '#8a5a8d',
  cyan: '#4a8a8a',
  white: '#A09C94',
  brightBlack: '#66614F',
  brightRed: '#B25A5A',
  brightGreen: '#7B8B6F',
  brightYellow: '#B89F56',
  brightBlue: '#7A96A8',
  brightMagenta: '#9b6b9e',
  brightCyan: '#5a9e9e',
  brightWhite: '#857f77',
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server/packages/web && npx vitest run theme/terminalColors
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd server
git add packages/web/src/theme/terminalColors.ts packages/web/src/theme/__tests__/terminalColors.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add terminal ANSI color theme ported from /embed/terminal

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1E: Auth Foundation (4 tasks)

### Task 10: API client + HttpError

**Files:**
- Create: `server/packages/web/src/api/errors.ts`
- Create: `server/packages/web/src/api/client.ts`
- Test: `server/packages/web/src/api/__tests__/client.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/packages/web/src/api/__tests__/client.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { ApiClient } from '../client';
import { HttpError } from '../errors';

describe('ApiClient', () => {
  const baseUrl = 'http://gateway.test:18765';
  const token = '1234';

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('verifyToken sends Authorization Bearer and returns true on 200', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const client = new ApiClient(baseUrl, token);
    const ok = await client.verifyToken();
    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://gateway.test:18765/api/auth/verify');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer 1234',
    });
  });

  it('verifyToken returns false on 401', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    const client = new ApiClient(baseUrl, token);
    expect(await client.verifyToken()).toBe(false);
  });

  it('listSessions parses array response', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { name: 'zen_dev', displayName: 'dev', created: 1, cwd: '/home', windows: [] },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new ApiClient(baseUrl, token);
    const sessions = await client.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].displayName).toBe('dev');
  });

  it('throws HttpError on non-2xx (other than auth verify)', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    const client = new ApiClient(baseUrl, token);
    await expect(client.listSessions()).rejects.toBeInstanceOf(HttpError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/web && npx vitest run api/client
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement errors.ts**

Create `server/packages/web/src/api/errors.ts`:

```ts
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message?: string,
  ) {
    super(message ?? `HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = 'HttpError';
  }
}
```

- [ ] **Step 4: Implement client.ts**

Create `server/packages/web/src/api/client.ts`:

```ts
import type { TmuxSession, TmuxWindow } from '@zenterm/shared';
import { HttpError } from './errors';

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
    };
    let payload: BodyInit | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: payload,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new HttpError(res.status, text);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    const contentType = res.headers.get('Content-Type') ?? '';
    if (contentType.includes('application/json')) {
      return (await res.json()) as T;
    }
    return (await res.text()) as T;
  }

  async verifyToken(): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/api/auth/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return res.ok;
  }

  listSessions(): Promise<TmuxSession[]> {
    return this.request<TmuxSession[]>('GET', '/api/sessions');
  }

  listWindows(sessionId: string): Promise<TmuxWindow[]> {
    return this.request<TmuxWindow[]>(
      'GET',
      `/api/sessions/${encodeURIComponent(sessionId)}/windows`,
    );
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server/packages/web && npx vitest run api/client
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
cd server
git add packages/web/src/api/
git commit -m "$(cat <<'EOF'
feat(web): add ApiClient with verify/listSessions/listWindows

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Auth store (zustand persist)

**Files:**
- Create: `server/packages/web/src/stores/auth.ts`
- Test: `server/packages/web/src/stores/__tests__/auth.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/packages/web/src/stores/__tests__/auth.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { useAuthStore } from '../auth';

describe('useAuthStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({ token: null, gatewayUrl: null });
  });

  it('initial state is unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.gatewayUrl).toBeNull();
    expect(state.isAuthenticated()).toBe(false);
  });

  it('login sets token and gatewayUrl', () => {
    useAuthStore.getState().login('1234', 'http://gateway.test:18765');
    const state = useAuthStore.getState();
    expect(state.token).toBe('1234');
    expect(state.gatewayUrl).toBe('http://gateway.test:18765');
    expect(state.isAuthenticated()).toBe(true);
  });

  it('logout clears state', () => {
    useAuthStore.getState().login('1234', 'http://gateway.test:18765');
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.gatewayUrl).toBeNull();
    expect(state.isAuthenticated()).toBe(false);
  });

  it('persists to localStorage on login', () => {
    useAuthStore.getState().login('5678', 'http://example.test:18765');
    const stored = window.localStorage.getItem('zenterm-auth');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!).state.token).toBe('5678');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/web && npx vitest run stores/auth
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement auth store**

Create `server/packages/web/src/stores/auth.ts`:

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  gatewayUrl: string | null;
  isAuthenticated: () => boolean;
  login: (token: string, gatewayUrl: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      gatewayUrl: null,
      isAuthenticated: () => get().token !== null && get().gatewayUrl !== null,
      login: (token, gatewayUrl) => set({ token, gatewayUrl }),
      logout: () => set({ token: null, gatewayUrl: null }),
    }),
    {
      name: 'zenterm-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, gatewayUrl: state.gatewayUrl }),
    },
  ),
);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server/packages/web && npx vitest run stores/auth
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd server
git add packages/web/src/stores/auth.ts packages/web/src/stores/__tests__/auth.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add useAuthStore with localStorage persist

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: LoginForm component

**Files:**
- Create: `server/packages/web/src/components/LoginForm.tsx`
- Test: `server/packages/web/src/components/__tests__/LoginForm.test.tsx`

- [ ] **Step 1: Write failing test**

Create `server/packages/web/src/components/__tests__/LoginForm.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../LoginForm';

describe('LoginForm', () => {
  it('disables submit until 4 digits entered', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    const submit = screen.getByRole('button', { name: /Connect/i });
    expect(submit).toBeDisabled();

    const input = screen.getByLabelText(/Token/i);
    await userEvent.type(input, '12');
    expect(submit).toBeDisabled();

    await userEvent.type(input, '34');
    expect(submit).toBeEnabled();
  });

  it('rejects non-digit characters', async () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    const input = screen.getByLabelText(/Token/i) as HTMLInputElement;
    await userEvent.type(input, 'a1b2c3d4');
    expect(input.value).toBe('1234');
  });

  it('calls onSubmit with token on submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} />);
    const input = screen.getByLabelText(/Token/i);
    await userEvent.type(input, '5678');
    await userEvent.click(screen.getByRole('button', { name: /Connect/i }));
    expect(onSubmit).toHaveBeenCalledWith('5678');
  });

  it('shows error when onSubmit throws', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Token が違います'));
    render(<LoginForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/Token/i), '0000');
    await userEvent.click(screen.getByRole('button', { name: /Connect/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Token が違います/);
  });

  it('shows the gateway URL', () => {
    render(<LoginForm onSubmit={vi.fn()} gatewayUrl="http://gateway.test:18765" />);
    expect(screen.getByText(/gateway\.test/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/web && npx vitest run LoginForm
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement LoginForm**

Create `server/packages/web/src/components/LoginForm.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { useTheme } from '@/theme';

export interface LoginFormProps {
  onSubmit: (token: string) => Promise<void>;
  gatewayUrl?: string;
}

export function LoginForm({ onSubmit, gatewayUrl }: LoginFormProps) {
  const { tokens } = useTheme();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (token.length !== 4) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: tokens.colors.surface,
        color: tokens.colors.textPrimary,
        padding: tokens.spacing['2xl'],
        borderRadius: tokens.radii.lg,
        width: '100%',
        maxWidth: 360,
        boxSizing: 'border-box',
      }}
    >
      <h2 style={{ margin: 0, marginBottom: tokens.spacing.lg, fontSize: tokens.typography.heading.fontSize }}>
        ZenTerm Web
      </h2>
      {gatewayUrl && (
        <p style={{ fontSize: tokens.typography.small.fontSize, color: tokens.colors.textMuted, margin: 0, marginBottom: tokens.spacing.lg, fontFamily: tokens.typography.mono.fontFamily }}>
          {gatewayUrl}
        </p>
      )}
      <label style={{ display: 'block', marginBottom: tokens.spacing.sm, fontSize: tokens.typography.smallMedium.fontSize, color: tokens.colors.textSecondary }}>
        Token
        <input
          autoFocus
          inputMode="numeric"
          pattern="\d*"
          maxLength={4}
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 4))}
          style={{
            display: 'block',
            marginTop: tokens.spacing.sm,
            width: '100%',
            padding: tokens.spacing.md,
            fontSize: 24,
            letterSpacing: 8,
            textAlign: 'center',
            fontFamily: tokens.typography.mono.fontFamily,
            background: tokens.colors.bg,
            color: tokens.colors.textPrimary,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radii.md,
            boxSizing: 'border-box',
          }}
          aria-invalid={Boolean(error)}
        />
      </label>
      {error && (
        <p role="alert" style={{ color: tokens.colors.error, fontSize: tokens.typography.small.fontSize, margin: `${tokens.spacing.sm}px 0` }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={token.length !== 4 || submitting}
        style={{
          width: '100%',
          padding: tokens.spacing.md,
          marginTop: tokens.spacing.md,
          background: tokens.colors.primary,
          color: tokens.colors.textInverse,
          border: 'none',
          borderRadius: tokens.radii.md,
          fontSize: tokens.typography.bodyMedium.fontSize,
          fontWeight: 600,
          cursor: token.length === 4 && !submitting ? 'pointer' : 'not-allowed',
          opacity: token.length === 4 && !submitting ? 1 : 0.5,
        }}
      >
        {submitting ? '…' : 'Connect'}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server/packages/web && npx vitest run LoginForm
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
cd server
git add packages/web/src/components/LoginForm.tsx packages/web/src/components/__tests__/LoginForm.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add LoginForm with 4-digit token input + validation

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Login route + integration with auth store

**Files:**
- Create: `server/packages/web/src/routes/login.tsx`
- Modify: `server/packages/web/src/App.tsx`
- Test: `server/packages/web/src/routes/__tests__/login.test.tsx`

- [ ] **Step 1: Write failing test**

Create `server/packages/web/src/routes/__tests__/login.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LoginRoute } from '../login';
import { useAuthStore } from '@/stores/auth';

describe('LoginRoute', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({ token: null, gatewayUrl: null });
    vi.stubGlobal('fetch', vi.fn());
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://gateway.test:18765' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('on successful login, sets auth store and navigates to /web/sessions', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('{}', { status: 200 }),
    );
    render(
      <MemoryRouter initialEntries={['/web/login']}>
        <Routes>
          <Route path="/web/login" element={<LoginRoute />} />
          <Route path="/web/sessions" element={<div>Sessions Screen</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(/Token/i), '1234');
    await userEvent.click(screen.getByRole('button', { name: /Connect/i }));
    expect(await screen.findByText('Sessions Screen')).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBe('1234');
    expect(useAuthStore.getState().gatewayUrl).toBe('http://gateway.test:18765');
  });

  it('on 401, shows error and stays on login', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );
    render(
      <MemoryRouter initialEntries={['/web/login']}>
        <Routes>
          <Route path="/web/login" element={<LoginRoute />} />
          <Route path="/web/sessions" element={<div>Sessions Screen</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(/Token/i), '0000');
    await userEvent.click(screen.getByRole('button', { name: /Connect/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Token/);
    expect(useAuthStore.getState().token).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/web && npx vitest run routes/login
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement LoginRoute**

Create `server/packages/web/src/routes/login.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '@/components/LoginForm';
import { ApiClient } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme';

export function LoginRoute() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const { tokens } = useTheme();

  const gatewayUrl = window.location.origin;

  const handleSubmit = async (token: string) => {
    const client = new ApiClient(gatewayUrl, token);
    const ok = await client.verifyToken();
    if (!ok) {
      throw new Error('Token が違います。Gateway 起動時に表示された 4 桁を入力してください。');
    }
    login(token, gatewayUrl);
    navigate('/web/sessions', { replace: true });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: tokens.colors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: tokens.spacing.xl,
      }}
    >
      <LoginForm onSubmit={handleSubmit} gatewayUrl={gatewayUrl} />
    </div>
  );
}
```

- [ ] **Step 4: Update App.tsx to wire the route**

Modify `server/packages/web/src/App.tsx`:

```tsx
import { Route, Routes, Navigate } from 'react-router-dom';
import { LoginRoute } from './routes/login';
import { useAuthStore } from './stores/auth';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthed = useAuthStore((s) => s.isAuthenticated());
  if (!isAuthed) return <Navigate to="/web/login" replace />;
  return <>{children}</>;
}

function SessionsPlaceholder() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>ZenTerm — Sessions</h1>
      <p>Coming next: Sidebar + TerminalPane.</p>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/web/login" element={<LoginRoute />} />
      <Route
        path="/web/sessions"
        element={
          <RequireAuth>
            <SessionsPlaceholder />
          </RequireAuth>
        }
      />
      <Route path="/web" element={<Navigate to="/web/sessions" replace />} />
      <Route path="*" element={<Navigate to="/web" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 5: Update App.test.tsx to expect Navigate to /web/login when unauth'd**

Modify `server/packages/web/src/__tests__/App.test.tsx`:

```tsx
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { useAuthStore } from '../stores/auth';

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({ token: null, gatewayUrl: null });
  });

  it('redirects unauthed user to /web/login showing the form', () => {
    render(
      <MemoryRouter initialEntries={['/web']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /ZenTerm Web/i })).toBeInTheDocument();
  });

  it('shows sessions placeholder when authed', () => {
    useAuthStore.setState({ token: '1234', gatewayUrl: 'http://gateway.test:18765' });
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /Sessions/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run all tests**

```bash
cd server/packages/web && npx vitest run
```

Expected: ALL PASS (App.test, login.test, LoginForm.test, etc.).

- [ ] **Step 7: Commit**

```bash
cd server
git add packages/web/src/routes/login.tsx packages/web/src/App.tsx packages/web/src/__tests__/App.test.tsx packages/web/src/routes/__tests__/login.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): wire LoginRoute with auth store and navigation guard

App redirects unauthenticated users to /web/login. On successful token
verification, the user is stored and routed to /web/sessions.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1F: Sessions List + Sidebar (3 tasks)

### Task 14: Sessions store

**Files:**
- Create: `server/packages/web/src/stores/sessions.ts`
- Test: `server/packages/web/src/stores/__tests__/sessions.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/packages/web/src/stores/__tests__/sessions.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import type { TmuxSession } from '@zenterm/shared';
import { useSessionsStore } from '../sessions';

const sampleSession = (name: string): TmuxSession => ({
  name,
  displayName: name,
  created: 1,
  cwd: '/home',
  windows: [],
});

describe('useSessionsStore', () => {
  beforeEach(() => {
    useSessionsStore.setState({ sessions: [], loading: false, error: null });
  });

  it('setSessions replaces the list', () => {
    useSessionsStore.getState().setSessions([sampleSession('a'), sampleSession('b')]);
    expect(useSessionsStore.getState().sessions.map((s) => s.name)).toEqual(['a', 'b']);
  });

  it('upsert adds new and updates existing by name', () => {
    useSessionsStore.getState().setSessions([sampleSession('a')]);
    useSessionsStore.getState().upsert(sampleSession('b'));
    expect(useSessionsStore.getState().sessions).toHaveLength(2);
    useSessionsStore.getState().upsert({ ...sampleSession('a'), cwd: '/new' });
    expect(useSessionsStore.getState().sessions.find((s) => s.name === 'a')?.cwd).toBe('/new');
  });

  it('remove drops session by name', () => {
    useSessionsStore.getState().setSessions([sampleSession('a'), sampleSession('b')]);
    useSessionsStore.getState().remove('a');
    expect(useSessionsStore.getState().sessions.map((s) => s.name)).toEqual(['b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/web && npx vitest run stores/sessions
```

Expected: FAIL.

- [ ] **Step 3: Implement sessions store**

Create `server/packages/web/src/stores/sessions.ts`:

```ts
import { create } from 'zustand';
import type { TmuxSession } from '@zenterm/shared';

interface SessionsState {
  sessions: TmuxSession[];
  loading: boolean;
  error: string | null;
  setSessions: (sessions: TmuxSession[]) => void;
  upsert: (session: TmuxSession) => void;
  remove: (name: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSessionsStore = create<SessionsState>((set) => ({
  sessions: [],
  loading: false,
  error: null,
  setSessions: (sessions) => set({ sessions }),
  upsert: (session) =>
    set((state) => {
      const idx = state.sessions.findIndex((s) => s.name === session.name);
      if (idx === -1) return { sessions: [...state.sessions, session] };
      const next = [...state.sessions];
      next[idx] = session;
      return { sessions: next };
    }),
  remove: (name) =>
    set((state) => ({ sessions: state.sessions.filter((s) => s.name !== name) })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server/packages/web && npx vitest run stores/sessions
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd server
git add packages/web/src/stores/sessions.ts packages/web/src/stores/__tests__/sessions.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add useSessionsStore with upsert/remove

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: SessionsListPanel component

**Files:**
- Create: `server/packages/web/src/components/SessionsListPanel.tsx`
- Test: `server/packages/web/src/components/__tests__/SessionsListPanel.test.tsx`

- [ ] **Step 1: Write failing test**

Create `server/packages/web/src/components/__tests__/SessionsListPanel.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TmuxSession } from '@zenterm/shared';
import { SessionsListPanel } from '../SessionsListPanel';

const sessions: TmuxSession[] = [
  {
    name: 'zen_dev',
    displayName: 'dev',
    created: 1,
    cwd: '/home/me/proj',
    windows: [
      { index: 0, name: 'main', active: true, zoomed: false, paneCount: 1, cwd: '/home/me/proj' },
      { index: 1, name: 'test', active: false, zoomed: false, paneCount: 1, cwd: '/home/me/proj' },
    ],
  },
];

describe('SessionsListPanel', () => {
  it('renders session names', () => {
    render(<SessionsListPanel sessions={sessions} onSelect={vi.fn()} activeSessionId={null} activeWindowIndex={null} />);
    expect(screen.getByText('dev')).toBeInTheDocument();
  });

  it('clicking a session calls onSelect with sessionId', async () => {
    const onSelect = vi.fn();
    render(<SessionsListPanel sessions={sessions} onSelect={onSelect} activeSessionId={null} activeWindowIndex={null} />);
    await userEvent.click(screen.getByText('dev'));
    expect(onSelect).toHaveBeenCalledWith('dev', undefined);
  });

  it('expands to show windows and clicking a window calls onSelect with index', async () => {
    const onSelect = vi.fn();
    render(<SessionsListPanel sessions={sessions} onSelect={onSelect} activeSessionId={null} activeWindowIndex={null} />);
    await userEvent.click(screen.getByLabelText(/Expand windows/i));
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('test')).toBeInTheDocument();
    await userEvent.click(screen.getByText('test'));
    expect(onSelect).toHaveBeenCalledWith('dev', 1);
  });

  it('highlights active session', () => {
    render(
      <SessionsListPanel
        sessions={sessions}
        onSelect={vi.fn()}
        activeSessionId="dev"
        activeWindowIndex={0}
      />,
    );
    const row = screen.getByText('dev').closest('button');
    expect(row).toHaveAttribute('aria-current', 'true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/web && npx vitest run SessionsListPanel
```

Expected: FAIL.

- [ ] **Step 3: Implement SessionsListPanel**

Create `server/packages/web/src/components/SessionsListPanel.tsx`:

```tsx
import { useState } from 'react';
import type { TmuxSession } from '@zenterm/shared';
import { useTheme } from '@/theme';

export interface SessionsListPanelProps {
  sessions: TmuxSession[];
  activeSessionId: string | null;
  activeWindowIndex: number | null;
  onSelect: (sessionId: string, windowIndex?: number) => void;
}

export function SessionsListPanel({
  sessions,
  activeSessionId,
  activeWindowIndex,
  onSelect,
}: SessionsListPanelProps) {
  const { tokens } = useTheme();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div style={{ padding: tokens.spacing.md, color: tokens.colors.textPrimary }}>
      <div
        style={{
          fontSize: tokens.typography.caption.fontSize,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          color: tokens.colors.textMuted,
          padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
        }}
      >
        Active · {sessions.length}
      </div>
      {sessions.map((session) => {
        const isActive = session.displayName === activeSessionId;
        const hasWindows = (session.windows?.length ?? 0) > 1;
        const isExpanded = expanded.has(session.name);
        return (
          <div key={session.name}>
            <button
              type="button"
              aria-current={isActive ? 'true' : undefined}
              onClick={() => onSelect(session.displayName)}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                gap: tokens.spacing.sm,
                padding: tokens.spacing.sm,
                margin: 0,
                background: isActive ? tokens.colors.primarySubtle : 'transparent',
                color: tokens.colors.textPrimary,
                border: 'none',
                borderRadius: tokens.radii.sm,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: tokens.colors.success,
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: tokens.typography.bodyMedium.fontSize }}>
                  {session.displayName}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: tokens.typography.small.fontSize,
                    color: tokens.colors.textMuted,
                    fontFamily: tokens.typography.mono.fontFamily,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={session.cwd}
                >
                  {session.cwd}
                </span>
              </span>
              {hasWindows && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={isExpanded ? 'Collapse windows' : 'Expand windows'}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(session.name);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(session.name);
                    }
                  }}
                  style={{
                    padding: tokens.spacing.xs,
                    color: tokens.colors.textMuted,
                    cursor: 'pointer',
                    fontSize: tokens.typography.caption.fontSize,
                  }}
                >
                  {isExpanded ? '▾' : '▸'}
                </span>
              )}
            </button>
            {isExpanded && session.windows && (
              <div style={{ paddingLeft: tokens.spacing.lg, borderLeft: `1px solid ${tokens.colors.borderSubtle}`, marginLeft: tokens.spacing.md }}>
                {session.windows.map((w) => {
                  const isWindowActive =
                    isActive && activeWindowIndex === w.index;
                  return (
                    <button
                      key={w.index}
                      type="button"
                      aria-current={isWindowActive ? 'true' : undefined}
                      onClick={() => onSelect(session.displayName, w.index)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: tokens.spacing.xs,
                        background: isWindowActive ? tokens.colors.primarySubtle : 'transparent',
                        border: 'none',
                        color: tokens.colors.textSecondary,
                        cursor: 'pointer',
                        fontSize: tokens.typography.smallMedium.fontSize,
                      }}
                    >
                      {w.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server/packages/web && npx vitest run SessionsListPanel
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd server
git add packages/web/src/components/SessionsListPanel.tsx packages/web/src/components/__tests__/SessionsListPanel.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add SessionsListPanel with expand/window selection

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Sidebar wrapper

**Files:**
- Create: `server/packages/web/src/components/Sidebar.tsx`
- Test: `server/packages/web/src/components/__tests__/Sidebar.test.tsx`

- [ ] **Step 1: Write failing test**

Create `server/packages/web/src/components/__tests__/Sidebar.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '../Sidebar';

describe('Sidebar', () => {
  it('renders sessions panel and bottom nav with 3 buttons', () => {
    render(<Sidebar sessions={[]} activeSessionId={null} activeWindowIndex={null} onSelect={vi.fn()} />);
    expect(screen.getByLabelText(/Sessions panel/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sessions tab/i })).toBeInTheDocument();
    // Files / Settings tabs are present but disabled in Phase 1
    expect(screen.getByRole('button', { name: /Files tab/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Settings tab/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/web && npx vitest run Sidebar
```

Expected: FAIL.

- [ ] **Step 3: Implement Sidebar**

Create `server/packages/web/src/components/Sidebar.tsx`:

```tsx
import type { TmuxSession } from '@zenterm/shared';
import { SessionsListPanel } from './SessionsListPanel';
import { useTheme } from '@/theme';

export interface SidebarProps {
  sessions: TmuxSession[];
  activeSessionId: string | null;
  activeWindowIndex: number | null;
  onSelect: (sessionId: string, windowIndex?: number) => void;
}

const SIDEBAR_WIDTH = 320;

export function Sidebar({
  sessions,
  activeSessionId,
  activeWindowIndex,
  onSelect,
}: SidebarProps) {
  const { tokens } = useTheme();
  return (
    <aside
      style={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        background: tokens.colors.bgElevated,
        borderRight: `1px solid ${tokens.colors.borderSubtle}`,
        display: 'grid',
        gridTemplateRows: '1fr 56px',
        height: '100vh',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div
        aria-label="Sessions panel"
        style={{ overflowY: 'auto' }}
      >
        <SessionsListPanel
          sessions={sessions}
          activeSessionId={activeSessionId}
          activeWindowIndex={activeWindowIndex}
          onSelect={onSelect}
        />
      </div>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          borderTop: `1px solid ${tokens.colors.borderSubtle}`,
          background: tokens.colors.bgElevated,
        }}
      >
        <button
          type="button"
          aria-label="Sessions tab"
          aria-pressed="true"
          style={{
            background: 'none',
            border: 'none',
            color: tokens.colors.primary,
            fontSize: tokens.typography.caption.fontSize,
            cursor: 'pointer',
            padding: tokens.spacing.sm,
          }}
        >
          ⌘ Sessions
        </button>
        <button
          type="button"
          aria-label="Files tab"
          disabled
          title="Coming in Phase 2"
          style={{
            background: 'none',
            border: 'none',
            color: tokens.colors.textMuted,
            fontSize: tokens.typography.caption.fontSize,
            cursor: 'not-allowed',
            padding: tokens.spacing.sm,
            opacity: 0.5,
          }}
        >
          📁 Files
        </button>
        <button
          type="button"
          aria-label="Settings tab"
          disabled
          title="Coming in Phase 2"
          style={{
            background: 'none',
            border: 'none',
            color: tokens.colors.textMuted,
            fontSize: tokens.typography.caption.fontSize,
            cursor: 'not-allowed',
            padding: tokens.spacing.sm,
            opacity: 0.5,
          }}
        >
          ⚙ Settings
        </button>
      </nav>
    </aside>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server/packages/web && npx vitest run Sidebar
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd server
git add packages/web/src/components/Sidebar.tsx packages/web/src/components/__tests__/Sidebar.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add Sidebar shell with bottom nav (Sessions only in Phase 1)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1G: Terminal Client (5 tasks)

### Task 17: terminalProtocol helpers

**Files:**
- Create: `server/packages/web/src/lib/terminalProtocol.ts`
- Test: `server/packages/web/src/lib/__tests__/terminalProtocol.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/packages/web/src/lib/__tests__/terminalProtocol.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { encodeInput, encodeResize, parseServerMessage } from '../terminalProtocol';

describe('terminalProtocol', () => {
  it('encodeInput returns JSON string', () => {
    expect(JSON.parse(encodeInput('ls\r'))).toEqual({ type: 'input', data: 'ls\r' });
  });

  it('encodeResize returns JSON string', () => {
    expect(JSON.parse(encodeResize(80, 24))).toEqual({ type: 'resize', cols: 80, rows: 24 });
  });

  it('parseServerMessage parses output', () => {
    const m = parseServerMessage('{"type":"output","data":"hello"}');
    expect(m).toEqual({ type: 'output', data: 'hello' });
  });

  it('parseServerMessage parses sessionInfo', () => {
    const m = parseServerMessage('{"type":"sessionInfo","session":{"name":"a","displayName":"a","created":1,"cwd":"/h"}}');
    expect(m?.type).toBe('sessionInfo');
  });

  it('parseServerMessage returns null for invalid JSON', () => {
    expect(parseServerMessage('not json')).toBeNull();
  });

  it('parseServerMessage returns null for unknown type', () => {
    expect(parseServerMessage('{"type":"xyz"}')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/web && npx vitest run terminalProtocol
```

Expected: FAIL.

- [ ] **Step 3: Implement terminalProtocol.ts**

Create `server/packages/web/src/lib/terminalProtocol.ts`:

```ts
import type { ClientMessage, ServerMessage } from '@zenterm/shared';

export function encodeInput(data: string): string {
  const msg: ClientMessage = { type: 'input', data };
  return JSON.stringify(msg);
}

export function encodeResize(cols: number, rows: number): string {
  const msg: ClientMessage = { type: 'resize', cols, rows };
  return JSON.stringify(msg);
}

export function encodeSignal(signal: string): string {
  const msg: ClientMessage = { type: 'signal', signal };
  return JSON.stringify(msg);
}

const VALID_SERVER_TYPES = new Set(['output', 'sessionInfo', 'exit', 'error']);

export function parseServerMessage(raw: string): ServerMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('type' in parsed) ||
    typeof (parsed as { type: unknown }).type !== 'string' ||
    !VALID_SERVER_TYPES.has((parsed as { type: string }).type)
  ) {
    return null;
  }
  return parsed as ServerMessage;
}

export function buildTerminalWsUrl(
  gatewayUrl: string,
  sessionId: string,
  windowIndex: number,
  token: string,
): string {
  const wsUrl = gatewayUrl.replace(/^http/, 'ws');
  const params = new URLSearchParams({
    sessionId,
    windowIndex: String(windowIndex),
    token,
  });
  return `${wsUrl}/ws/terminal?${params.toString()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server/packages/web && npx vitest run terminalProtocol
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
cd server
git add packages/web/src/lib/terminalProtocol.ts packages/web/src/lib/__tests__/terminalProtocol.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add terminal WS protocol helpers (encode/parse/url)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: imeDedup logic

**Files:**
- Create: `server/packages/web/src/lib/imeDedup.ts`
- Test: `server/packages/web/src/lib/__tests__/imeDedup.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/packages/web/src/lib/__tests__/imeDedup.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { createImeDedup } from '../imeDedup';

describe('createImeDedup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes single-character input always', () => {
    const dedup = createImeDedup();
    expect(dedup.shouldPass('a', 0)).toBe(true);
    expect(dedup.shouldPass('a', 50)).toBe(true);
  });

  it('passes control characters always', () => {
    const dedup = createImeDedup();
    expect(dedup.shouldPass('\x1b', 0)).toBe(true);
    expect(dedup.shouldPass('\x1b', 50)).toBe(true);
  });

  it('drops duplicate multi-char input within 100ms', () => {
    const dedup = createImeDedup();
    expect(dedup.shouldPass('hello', 0)).toBe(true);
    expect(dedup.shouldPass('hello', 50)).toBe(false);
    expect(dedup.shouldPass('hello', 99)).toBe(false);
  });

  it('passes duplicate multi-char input after 100ms', () => {
    const dedup = createImeDedup();
    expect(dedup.shouldPass('hello', 0)).toBe(true);
    expect(dedup.shouldPass('hello', 100)).toBe(true);
    expect(dedup.shouldPass('hello', 200)).toBe(true);
  });

  it('different input within 100ms passes', () => {
    const dedup = createImeDedup();
    expect(dedup.shouldPass('hello', 0)).toBe(true);
    expect(dedup.shouldPass('world', 50)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/web && npx vitest run imeDedup
```

Expected: FAIL.

- [ ] **Step 3: Implement imeDedup.ts**

Create `server/packages/web/src/lib/imeDedup.ts`:

```ts
const IME_DEDUP_MS = 100;

export interface ImeDedup {
  shouldPass(data: string, now: number): boolean;
}

export function createImeDedup(): ImeDedup {
  let lastData = '';
  let lastTime = 0;
  return {
    shouldPass(data, now) {
      const isControl = data.length === 1 || data.charCodeAt(0) <= 0x1f;
      if (isControl) return true;
      if (data === lastData && now - lastTime < IME_DEDUP_MS) {
        return false;
      }
      lastData = data;
      lastTime = now;
      return true;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server/packages/web && npx vitest run imeDedup
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
cd server
git add packages/web/src/lib/imeDedup.ts packages/web/src/lib/__tests__/imeDedup.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add IME dedup helper (100ms duplicate suppression)

Mirrors the dedup logic from /embed/terminal/index.html so PC web users
get the same compositionend+input double-fire protection as mobile.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: reconnectBackoff state machine

**Files:**
- Create: `server/packages/web/src/lib/reconnectBackoff.ts`
- Test: `server/packages/web/src/lib/__tests__/reconnectBackoff.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/packages/web/src/lib/__tests__/reconnectBackoff.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createReconnectBackoff } from '../reconnectBackoff';

describe('createReconnectBackoff', () => {
  it('starts at 1000ms', () => {
    const b = createReconnectBackoff();
    expect(b.next()).toEqual({ delayMs: 1000, attempt: 1, exhausted: false });
  });

  it('doubles each attempt up to 30000ms cap', () => {
    const b = createReconnectBackoff();
    expect(b.next().delayMs).toBe(1000);
    expect(b.next().delayMs).toBe(2000);
    expect(b.next().delayMs).toBe(4000);
    expect(b.next().delayMs).toBe(8000);
    expect(b.next().delayMs).toBe(16000);
    expect(b.next().delayMs).toBe(30000);
    expect(b.next().delayMs).toBe(30000);
  });

  it('exhausted after 20 attempts', () => {
    const b = createReconnectBackoff();
    let lastResult = b.next();
    for (let i = 0; i < 19; i++) lastResult = b.next();
    expect(lastResult.attempt).toBe(20);
    expect(lastResult.exhausted).toBe(false);
    const beyond = b.next();
    expect(beyond.exhausted).toBe(true);
  });

  it('reset() restarts from initial', () => {
    const b = createReconnectBackoff();
    b.next();
    b.next();
    b.reset();
    expect(b.next().delayMs).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/web && npx vitest run reconnectBackoff
```

Expected: FAIL.

- [ ] **Step 3: Implement reconnectBackoff.ts**

Create `server/packages/web/src/lib/reconnectBackoff.ts`:

```ts
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const MAX_ATTEMPTS = 20;

export interface BackoffStep {
  delayMs: number;
  attempt: number;
  exhausted: boolean;
}

export interface ReconnectBackoff {
  next(): BackoffStep;
  reset(): void;
}

export function createReconnectBackoff(): ReconnectBackoff {
  let attempt = 0;
  let delay = INITIAL_DELAY_MS;
  return {
    next() {
      attempt += 1;
      if (attempt > MAX_ATTEMPTS) {
        return { delayMs: delay, attempt, exhausted: true };
      }
      const step: BackoffStep = { delayMs: delay, attempt, exhausted: false };
      delay = Math.min(delay * 2, MAX_DELAY_MS);
      return step;
    },
    reset() {
      attempt = 0;
      delay = INITIAL_DELAY_MS;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server/packages/web && npx vitest run reconnectBackoff
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd server
git add packages/web/src/lib/reconnectBackoff.ts packages/web/src/lib/__tests__/reconnectBackoff.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add exponential reconnect backoff (1s→30s, 20 attempts)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: XtermView component

**Files:**
- Create: `server/packages/web/src/components/terminal/XtermView.tsx`
- Test: `server/packages/web/src/components/terminal/__tests__/XtermView.test.tsx`

Note: xterm.js is hard to fully test in jsdom (it needs DOM measurement). We test the WS wiring and lifecycle behavior; visual rendering is verified via E2E.

- [ ] **Step 1: Write failing test**

Create `server/packages/web/src/components/terminal/__tests__/XtermView.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

// xterm.js can't render in jsdom (no canvas). Mock the modules so the
// component tree mounts cleanly while we test WS / lifecycle wiring.
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    write: vi.fn(),
    reset: vi.fn(),
    dispose: vi.fn(),
    focus: vi.fn(),
    loadAddon: vi.fn(),
    options: {},
    cols: 80,
    rows: 24,
    unicode: { activeVersion: '6' },
  })),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({ fit: vi.fn() })),
}));

vi.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@xterm/xterm/css/xterm.css', () => ({ default: '' }));

import { XtermView } from '../XtermView';

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];
  url: string;
  readyState = 0;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code?: number) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: code ?? 1000 } as CloseEvent);
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({} as Event);
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('XtermView', () => {
  it('opens a WebSocket with the right URL on mount', () => {
    render(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isFocused
        theme="dark"
        fontSize={14}
        onStatusChange={() => undefined}
      />,
    );
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toBe(
      'ws://gateway.test:18765/ws/terminal?sessionId=dev&windowIndex=0&token=1234',
    );
  });

  it('reports connected status when WS opens', () => {
    const onStatus = vi.fn();
    render(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isFocused
        theme="dark"
        fontSize={14}
        onStatusChange={onStatus}
      />,
    );
    expect(onStatus).toHaveBeenCalledWith('disconnected');
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });
    expect(onStatus).toHaveBeenCalledWith('connected');
  });

  it('closes the WS on unmount', () => {
    const { unmount } = render(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isFocused
        theme="dark"
        fontSize={14}
        onStatusChange={() => undefined}
      />,
    );
    const ws = MockWebSocket.instances[0];
    unmount();
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
  });

  it('reconnects with backoff on unexpected close', async () => {
    vi.useFakeTimers();
    render(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isFocused
        theme="dark"
        fontSize={14}
        onStatusChange={() => undefined}
      />,
    );
    expect(MockWebSocket.instances).toHaveLength(1);
    act(() => {
      MockWebSocket.instances[0].onclose?.({ code: 1006 } as CloseEvent);
    });
    expect(MockWebSocket.instances).toHaveLength(1); // not yet reconnected
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(MockWebSocket.instances).toHaveLength(2);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/web && npx vitest run XtermView
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement XtermView**

Create `server/packages/web/src/components/terminal/XtermView.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

import { terminalColorsDark, terminalColorsLight } from '@/theme/terminalColors';
import { createImeDedup } from '@/lib/imeDedup';
import { createReconnectBackoff } from '@/lib/reconnectBackoff';
import {
  buildTerminalWsUrl,
  encodeInput,
  encodeResize,
  parseServerMessage,
} from '@/lib/terminalProtocol';

export type TerminalStatus = 'connected' | 'disconnected' | 'error' | 'reconnecting';

export interface XtermViewProps {
  gatewayUrl: string;
  token: string;
  sessionId: string;
  windowIndex: number;
  isFocused: boolean;
  theme: 'dark' | 'light';
  fontSize: number;
  onStatusChange: (status: TerminalStatus) => void;
}

const FONT_FAMILY =
  '"Noto Sans Mono CJK JP", "Noto Sans Mono", "DejaVu Sans Mono", monospace';

export function XtermView({
  gatewayUrl,
  token,
  sessionId,
  windowIndex,
  isFocused,
  theme,
  fontSize,
  onStatusChange,
}: XtermViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(createReconnectBackoff());
  const dedupRef = useRef(createImeDedup());
  const reconnectTimerRef = useRef<number | null>(null);
  const isUnmountedRef = useRef(false);

  // Create xterm once on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const palette = theme === 'light' ? terminalColorsLight : terminalColorsDark;
    const term = new Terminal({
      allowProposedApi: true,
      fontFamily: FONT_FAMILY,
      fontSize,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
      theme: palette,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new Unicode11Addon());
    term.unicode.activeVersion = '11';
    term.loadAddon(new WebLinksAddon());

    term.open(container);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    return () => {
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply theme/fontSize updates
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = theme === 'light' ? terminalColorsLight : terminalColorsDark;
    term.options.fontSize = fontSize;
    fitRef.current?.fit();
  }, [theme, fontSize]);

  // Apply focus
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.disableStdin = !isFocused;
    if (isFocused) term.focus();
  }, [isFocused]);

  // WebSocket connect & reconnect
  useEffect(() => {
    isUnmountedRef.current = false;
    backoffRef.current.reset();

    const connect = () => {
      if (isUnmountedRef.current) return;
      const term = termRef.current;
      if (!term) return;

      const url = buildTerminalWsUrl(gatewayUrl, sessionId, windowIndex, token);
      const ws = new WebSocket(url);
      wsRef.current = ws;
      onStatusChange('disconnected');

      ws.onopen = () => {
        backoffRef.current.reset();
        term.reset();
        fitRef.current?.fit();
        ws.send(encodeResize(term.cols, term.rows));
        onStatusChange('connected');
      };

      ws.onmessage = (ev) => {
        const msg = parseServerMessage(typeof ev.data === 'string' ? ev.data : '');
        if (!msg) return;
        if (msg.type === 'output') {
          term.write(msg.data);
        } else if (msg.type === 'error') {
          onStatusChange('error');
        }
      };

      ws.onclose = (ev) => {
        wsRef.current = null;
        if (ev.code === 1000 || ev.code === 1008) {
          onStatusChange('disconnected');
          return;
        }
        const step = backoffRef.current.next();
        if (step.exhausted) {
          onStatusChange('error');
          return;
        }
        onStatusChange('reconnecting');
        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, step.delayMs);
      };

      ws.onerror = () => onStatusChange('error');
    };

    connect();

    const term = termRef.current;
    const onDataDisposable = term?.onData((data) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const now = performance.now();
      if (!dedupRef.current.shouldPass(data, now)) return;
      ws.send(encodeInput(data));
    });

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      onDataDisposable?.dispose();
      const ws = wsRef.current;
      if (ws) {
        ws.onclose = null;
        ws.close(1000);
        wsRef.current = null;
      }
    };
  }, [gatewayUrl, token, sessionId, windowIndex, onStatusChange]);

  // ResizeObserver → fit + send resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const fit = fitRef.current;
        const term = termRef.current;
        const ws = wsRef.current;
        if (!fit || !term) return;
        fit.fit();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(encodeResize(term.cols, term.rows));
        }
      });
    });
    ro.observe(container);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: theme === 'light' ? terminalColorsLight.background : terminalColorsDark.background,
      }}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server/packages/web && npx vitest run XtermView
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd server
git add packages/web/src/components/terminal/
git commit -m "$(cat <<'EOF'
feat(web): add XtermView component (xterm.js + WS + IME + reconnect)

Mounts xterm.js into a React component, wires the /ws/terminal
WebSocket protocol with IME dedup and exponential reconnect, and tracks
focus / theme / fontSize through props. ResizeObserver keeps the
terminal grid in sync with the container.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 21: TerminalPane (toolbar + XtermView wrapper)

**Files:**
- Create: `server/packages/web/src/components/TerminalPane.tsx`
- Test: `server/packages/web/src/components/__tests__/TerminalPane.test.tsx`

- [ ] **Step 1: Write failing test**

Create `server/packages/web/src/components/__tests__/TerminalPane.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Same xterm.js mocks as XtermView test — TerminalPane mounts XtermView
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    write: vi.fn(),
    reset: vi.fn(),
    dispose: vi.fn(),
    focus: vi.fn(),
    loadAddon: vi.fn(),
    options: {},
    cols: 80,
    rows: 24,
    unicode: { activeVersion: '6' },
  })),
}));
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({ fit: vi.fn() })),
}));
vi.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@xterm/xterm/css/xterm.css', () => ({ default: '' }));

import { TerminalPane } from '../TerminalPane';

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];
  url: string;
  readyState = 0;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  send = vi.fn();
  close() { this.readyState = MockWebSocket.CLOSED; }
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  // matchMedia for theme detection
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TerminalPane', () => {
  it('shows empty state when no session selected', () => {
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId={null}
        windowIndex={null}
      />,
    );
    expect(screen.getByText(/Select a session/i)).toBeInTheDocument();
  });

  it('shows session/window in toolbar when active', () => {
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={2}
      />,
    );
    expect(screen.getByText(/dev/)).toBeInTheDocument();
    expect(screen.getByText(/w2/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/web && npx vitest run TerminalPane
```

Expected: FAIL.

- [ ] **Step 3: Implement TerminalPane**

Create `server/packages/web/src/components/TerminalPane.tsx`:

```tsx
import { useState } from 'react';
import { XtermView, type TerminalStatus } from './terminal/XtermView';
import { useTheme } from '@/theme';

export interface TerminalPaneProps {
  gatewayUrl: string;
  token: string;
  sessionId: string | null;
  windowIndex: number | null;
}

export function TerminalPane({
  gatewayUrl,
  token,
  sessionId,
  windowIndex,
}: TerminalPaneProps) {
  const { tokens, mode } = useTheme();
  const [status, setStatus] = useState<TerminalStatus>('disconnected');

  const statusColor: string = (() => {
    switch (status) {
      case 'connected':
        return tokens.colors.success;
      case 'reconnecting':
        return tokens.colors.warning;
      case 'error':
        return tokens.colors.error;
      default:
        return tokens.colors.textMuted;
    }
  })();

  if (sessionId === null || windowIndex === null) {
    return (
      <main
        style={{
          flex: 1,
          background: tokens.colors.bg,
          color: tokens.colors.textSecondary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Select a session from the sidebar to start.
      </main>
    );
  }

  const themeMode = mode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : mode;

  return (
    <section
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateRows: '48px 1fr',
        height: '100vh',
        background: tokens.colors.bg,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing.sm,
          padding: `0 ${tokens.spacing.lg}px`,
          borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
          background: tokens.colors.bgElevated,
          color: tokens.colors.textPrimary,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: tokens.typography.bodyMedium.fontSize }}>
          {sessionId}
        </span>
        <span style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.smallMedium.fontSize }}>
          · w{windowIndex}
        </span>
        <span style={{ flex: 1 }} />
        <span
          aria-label={`Connection ${status}`}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor,
          }}
        />
      </header>
      <div style={{ minHeight: 0 }}>
        <XtermView
          gatewayUrl={gatewayUrl}
          token={token}
          sessionId={sessionId}
          windowIndex={windowIndex}
          isFocused
          theme={themeMode}
          fontSize={14}
          onStatusChange={setStatus}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server/packages/web && npx vitest run TerminalPane
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd server
git add packages/web/src/components/TerminalPane.tsx packages/web/src/components/__tests__/TerminalPane.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add TerminalPane (toolbar + XtermView + status dot)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1H: Sessions Route + Integration (3 tasks)

### Task 22: useSessionView store + sessions route

**Files:**
- Create: `server/packages/web/src/stores/sessionView.ts`
- Create: `server/packages/web/src/routes/sessions.tsx`
- Modify: `server/packages/web/src/App.tsx` (replace placeholder)
- Test: `server/packages/web/src/stores/__tests__/sessionView.test.ts`
- Test: `server/packages/web/src/routes/__tests__/sessions.test.tsx`

- [ ] **Step 1: Write failing test for sessionView store**

Create `server/packages/web/src/stores/__tests__/sessionView.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { useSessionViewStore } from '../sessionView';

describe('useSessionViewStore', () => {
  beforeEach(() => {
    useSessionViewStore.setState({ activeSessionId: null, activeWindowIndex: null });
  });

  it('open with default windowIndex', () => {
    useSessionViewStore.getState().open('dev');
    const state = useSessionViewStore.getState();
    expect(state.activeSessionId).toBe('dev');
    expect(state.activeWindowIndex).toBeNull();
  });

  it('open with specified windowIndex', () => {
    useSessionViewStore.getState().open('dev', 2);
    const state = useSessionViewStore.getState();
    expect(state.activeSessionId).toBe('dev');
    expect(state.activeWindowIndex).toBe(2);
  });

  it('close clears state', () => {
    useSessionViewStore.getState().open('dev', 0);
    useSessionViewStore.getState().close();
    const state = useSessionViewStore.getState();
    expect(state.activeSessionId).toBeNull();
    expect(state.activeWindowIndex).toBeNull();
  });

  it('setWindow updates only windowIndex', () => {
    useSessionViewStore.getState().open('dev', 0);
    useSessionViewStore.getState().setWindow(3);
    expect(useSessionViewStore.getState().activeSessionId).toBe('dev');
    expect(useSessionViewStore.getState().activeWindowIndex).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/packages/web && npx vitest run sessionView
```

Expected: FAIL.

- [ ] **Step 3: Implement sessionView store**

Create `server/packages/web/src/stores/sessionView.ts`:

```ts
import { create } from 'zustand';

interface SessionViewState {
  activeSessionId: string | null;
  activeWindowIndex: number | null;
  open: (sessionId: string, windowIndex?: number) => void;
  close: () => void;
  setWindow: (windowIndex: number) => void;
}

export const useSessionViewStore = create<SessionViewState>((set) => ({
  activeSessionId: null,
  activeWindowIndex: null,
  open: (sessionId, windowIndex) =>
    set({ activeSessionId: sessionId, activeWindowIndex: windowIndex ?? null }),
  close: () => set({ activeSessionId: null, activeWindowIndex: null }),
  setWindow: (windowIndex) => set({ activeWindowIndex: windowIndex }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server/packages/web && npx vitest run sessionView
```

Expected: PASS.

- [ ] **Step 5: Write failing test for sessions route**

Create `server/packages/web/src/routes/__tests__/sessions.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// xterm mocks (TerminalPane mounts XtermView once a session is selected)
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    write: vi.fn(),
    reset: vi.fn(),
    dispose: vi.fn(),
    focus: vi.fn(),
    loadAddon: vi.fn(),
    options: {},
    cols: 80,
    rows: 24,
    unicode: { activeVersion: '6' },
  })),
}));
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({ fit: vi.fn() })),
}));
vi.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@xterm/xterm/css/xterm.css', () => ({ default: '' }));

import { SessionsRoute } from '../sessions';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { useSessionViewStore } from '@/stores/sessionView';

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  url: string;
  readyState = 0;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  send = vi.fn();
  close() { this.readyState = MockWebSocket.CLOSED; }
  constructor(url: string) { this.url = url; }
}

beforeEach(() => {
  window.localStorage.clear();
  useAuthStore.setState({ token: '1234', gatewayUrl: 'http://gateway.test:18765' });
  useSessionsStore.setState({ sessions: [], loading: false, error: null });
  useSessionViewStore.setState({ activeSessionId: null, activeWindowIndex: null });
  vi.stubGlobal('fetch', vi.fn());
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SessionsRoute', () => {
  it('loads sessions on mount and renders Sidebar entries', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { name: 'zen_dev', displayName: 'dev', created: 1, cwd: '/h', windows: [] },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    render(
      <MemoryRouter>
        <SessionsRoute />
      </MemoryRouter>,
    );
    expect(await screen.findByText('dev')).toBeInTheDocument();
    expect(screen.getByText(/Select a session/i)).toBeInTheDocument();
  });

  it('clicking a session opens TerminalPane with session/window in header', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { name: 'zen_dev', displayName: 'dev', created: 1, cwd: '/h', windows: [] },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    render(
      <MemoryRouter>
        <SessionsRoute />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByText('dev'));
    // Toolbar shows the session name
    expect(screen.getAllByText(/dev/).length).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
cd server/packages/web && npx vitest run routes/sessions
```

Expected: FAIL.

- [ ] **Step 7: Implement SessionsRoute**

Create `server/packages/web/src/routes/sessions.tsx`:

```tsx
import { useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TerminalPane } from '@/components/TerminalPane';
import { ApiClient } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { useSessionViewStore } from '@/stores/sessionView';
import { useTheme } from '@/theme';

export function SessionsRoute() {
  const { tokens } = useTheme();
  const token = useAuthStore((s) => s.token);
  const gatewayUrl = useAuthStore((s) => s.gatewayUrl);
  const sessions = useSessionsStore((s) => s.sessions);
  const setSessions = useSessionsStore((s) => s.setSessions);
  const setError = useSessionsStore((s) => s.setError);
  const activeSessionId = useSessionViewStore((s) => s.activeSessionId);
  const activeWindowIndex = useSessionViewStore((s) => s.activeWindowIndex);
  const open = useSessionViewStore((s) => s.open);

  useEffect(() => {
    if (!token || !gatewayUrl) return;
    const client = new ApiClient(gatewayUrl, token);
    client.listSessions().then(setSessions).catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [token, gatewayUrl, setSessions, setError]);

  if (!token || !gatewayUrl) {
    // Should never happen — RequireAuth guards this. But keep a safety fallback.
    return null;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: tokens.colors.bg }}>
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        activeWindowIndex={activeWindowIndex}
        onSelect={(sessionId, windowIndex) => open(sessionId, windowIndex ?? 0)}
      />
      <TerminalPane
        gatewayUrl={gatewayUrl}
        token={token}
        sessionId={activeSessionId}
        windowIndex={activeWindowIndex}
      />
    </div>
  );
}
```

- [ ] **Step 8: Wire SessionsRoute in App.tsx**

Modify `server/packages/web/src/App.tsx`:

```tsx
import { Route, Routes, Navigate } from 'react-router-dom';
import { LoginRoute } from './routes/login';
import { SessionsRoute } from './routes/sessions';
import { useAuthStore } from './stores/auth';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthed = useAuthStore((s) => s.isAuthenticated());
  if (!isAuthed) return <Navigate to="/web/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/web/login" element={<LoginRoute />} />
      <Route
        path="/web/sessions"
        element={
          <RequireAuth>
            <SessionsRoute />
          </RequireAuth>
        }
      />
      <Route path="/web" element={<Navigate to="/web/sessions" replace />} />
      <Route path="*" element={<Navigate to="/web" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 9: Update App.test.tsx — sessions placeholder gone**

Modify `server/packages/web/src/__tests__/App.test.tsx` — replace the second test:

```tsx
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { useAuthStore } from '../stores/auth';

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({ token: null, gatewayUrl: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects unauthed user to /web/login showing the form', () => {
    render(
      <MemoryRouter initialEntries={['/web']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /ZenTerm Web/i })).toBeInTheDocument();
  });

  it('shows sessions screen when authed', async () => {
    useAuthStore.setState({ token: '1234', gatewayUrl: 'http://gateway.test:18765' });
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText(/Sessions panel/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run all tests**

```bash
cd server/packages/web && npx vitest run
```

Expected: ALL PASS.

- [ ] **Step 11: Commit**

```bash
cd server
git add packages/web/src/stores/sessionView.ts packages/web/src/stores/__tests__/sessionView.test.ts packages/web/src/routes/sessions.tsx packages/web/src/routes/__tests__/sessions.test.tsx packages/web/src/App.tsx packages/web/src/__tests__/App.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): wire SessionsRoute with Sidebar + TerminalPane

Loads sessions on mount, renders sidebar entries, and opens the
terminal pane when a session is selected.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 23: 401 handling redirect

**Files:**
- Modify: `server/packages/web/src/api/client.ts`
- Modify: `server/packages/web/src/routes/sessions.tsx`
- Test: `server/packages/web/src/api/__tests__/client.test.ts` (extend)

- [ ] **Step 1: Extend test for 401 handling**

Append to `server/packages/web/src/api/__tests__/client.test.ts` inside the existing `describe`:

```ts
  it('listSessions throws HttpError with status 401 on auth failure', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    const client = new ApiClient(baseUrl, token);
    await expect(client.listSessions()).rejects.toMatchObject({
      status: 401,
    });
  });
```

- [ ] **Step 2: Run test (should already pass since HttpError preserves status)**

```bash
cd server/packages/web && npx vitest run api/client
```

Expected: PASS.

- [ ] **Step 3: Update SessionsRoute to handle 401**

Modify `server/packages/web/src/routes/sessions.tsx`. Replace the useEffect with:

```tsx
import { HttpError } from '@/api/errors';
import { useNavigate } from 'react-router-dom';

// inside SessionsRoute component (replace the existing useEffect):
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!token || !gatewayUrl) return;
    const client = new ApiClient(gatewayUrl, token);
    client
      .listSessions()
      .then(setSessions)
      .catch((err) => {
        if (err instanceof HttpError && err.status === 401) {
          logout();
          navigate('/web/login', { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [token, gatewayUrl, setSessions, setError, logout, navigate]);
```

(Make sure the imports at the top include `HttpError` and `useNavigate`.)

Full updated file:

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { TerminalPane } from '@/components/TerminalPane';
import { ApiClient } from '@/api/client';
import { HttpError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { useSessionViewStore } from '@/stores/sessionView';
import { useTheme } from '@/theme';

export function SessionsRoute() {
  const { tokens } = useTheme();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const gatewayUrl = useAuthStore((s) => s.gatewayUrl);
  const logout = useAuthStore((s) => s.logout);
  const sessions = useSessionsStore((s) => s.sessions);
  const setSessions = useSessionsStore((s) => s.setSessions);
  const setError = useSessionsStore((s) => s.setError);
  const activeSessionId = useSessionViewStore((s) => s.activeSessionId);
  const activeWindowIndex = useSessionViewStore((s) => s.activeWindowIndex);
  const open = useSessionViewStore((s) => s.open);

  useEffect(() => {
    if (!token || !gatewayUrl) return;
    const client = new ApiClient(gatewayUrl, token);
    client
      .listSessions()
      .then(setSessions)
      .catch((err) => {
        if (err instanceof HttpError && err.status === 401) {
          logout();
          navigate('/web/login', { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [token, gatewayUrl, setSessions, setError, logout, navigate]);

  if (!token || !gatewayUrl) return null;

  return (
    <div style={{ display: 'flex', height: '100vh', background: tokens.colors.bg }}>
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        activeWindowIndex={activeWindowIndex}
        onSelect={(sessionId, windowIndex) => open(sessionId, windowIndex ?? 0)}
      />
      <TerminalPane
        gatewayUrl={gatewayUrl}
        token={token}
        sessionId={activeSessionId}
        windowIndex={activeWindowIndex}
      />
    </div>
  );
}
```

- [ ] **Step 4: Add a test for 401 redirect**

Append to `server/packages/web/src/routes/__tests__/sessions.test.tsx`:

```tsx
  it('on 401 from listSessions, logs out and redirects to /web/login', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <SessionsRoute />
      </MemoryRouter>,
    );
    // Wait for state to settle: useAuthStore should be cleared
    await vi.waitFor(() => {
      expect(useAuthStore.getState().token).toBeNull();
    });
  });
```

- [ ] **Step 5: Run all tests**

```bash
cd server/packages/web && npx vitest run
```

Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
cd server
git add packages/web/src/api/__tests__/client.test.ts packages/web/src/routes/sessions.tsx packages/web/src/routes/__tests__/sessions.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): handle 401 by logging out and redirecting to login

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 24: E2E test (Playwright) — login → sessions → terminal

**Files:**
- Create: `server/tests/e2e/web/login.spec.ts`
- Create: `server/tests/e2e/web/terminal.spec.ts`
- Modify: `server/playwright.config.ts` (if needed; ensure the test dir is included)

- [ ] **Step 1: Inspect existing Playwright config**

```bash
cd server && cat playwright.config.ts
```

Note the `testDir` (likely `./tests/e2e` or similar). Confirm new specs at `server/tests/e2e/web/*.spec.ts` will be picked up. If `testDir` excludes `web/`, modify it to include.

- [ ] **Step 2: Build gateway and web (smoke prerequisite)**

```bash
cd server && npm run build:gateway && npm run build:web
```

Expected: both build successfully; `gateway/public/web/index.html` is the built SPA (not the placeholder).

- [ ] **Step 3: Create login E2E spec**

Create `server/tests/e2e/web/login.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4321';

test.beforeAll(async () => {
  const home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(
    join(home, '.config', 'zenterm', '.env'),
    `AUTH_TOKEN=${TOKEN}\nPORT=18799\nHOST=127.0.0.1\n`,
  );

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: { ...process.env, HOME: home, PORT: '18799', HOST: '127.0.0.1', AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error' },
    stdio: 'inherit',
  });
  baseUrl = 'http://127.0.0.1:18799';

  // Wait for gateway to be ready
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

test('login with valid token navigates to sessions screen', async ({ page }) => {
  await page.goto(`${baseUrl}/web`);
  await expect(page.getByRole('heading', { name: /ZenTerm Web/i })).toBeVisible();
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /Connect/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });
});

test('login with wrong token shows error', async ({ page }) => {
  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill('0000');
  await page.getByRole('button', { name: /Connect/i }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});
```

- [ ] **Step 4: Create terminal E2E spec**

Create `server/tests/e2e/web/terminal.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '5432';

test.beforeAll(async () => {
  const home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(
    join(home, '.config', 'zenterm', '.env'),
    `AUTH_TOKEN=${TOKEN}\nPORT=18798\nHOST=127.0.0.1\n`,
  );

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: { ...process.env, HOME: home, PORT: '18798', HOST: '127.0.0.1', AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error' },
    stdio: 'inherit',
  });
  baseUrl = 'http://127.0.0.1:18798';

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
  // Cleanup: kill any session created during test
  try {
    await fetch(`${baseUrl}/api/sessions/e2e-term`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  } catch { /* ignore */ }
  gateway?.kill();
});

test('opens a terminal and sees command output', async ({ page }) => {
  // Pre-create a session via API so the sidebar has something to show
  const created = await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'e2e-term' }),
  });
  expect(created.ok).toBe(true);

  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /Connect/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  // Click the session
  await page.getByText('e2e-term').click();

  // Wait for connection status to be 'connected'
  await expect(page.getByLabel(/Connection connected/i)).toBeVisible({ timeout: 5000 });

  // Type a command and assert output appears in xterm DOM
  await page.locator('.xterm-helper-textarea').focus();
  await page.keyboard.type('echo hello-from-e2e');
  await page.keyboard.press('Enter');

  await expect(page.locator('.xterm-rows')).toContainText('hello-from-e2e', { timeout: 5000 });
});
```

- [ ] **Step 5: Run E2E tests**

```bash
cd server && npx playwright test tests/e2e/web/
```

Expected: 3 tests pass (2 login + 1 terminal).

- [ ] **Step 6: Commit**

```bash
cd server
git add tests/e2e/web/login.spec.ts tests/e2e/web/terminal.spec.ts
git commit -m "$(cat <<'EOF'
test(web): add E2E for login → sessions and terminal output

Spawns a real gateway with an isolated HOME, navigates the SPA, and
asserts the full path: open /web → enter token → see sessions list →
click → terminal connects → command output appears in xterm DOM.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1 Wrap-up

### Task 25: Tag the phase, update spec status

**Files:**
- Modify: `server/docs/superpowers/specs/2026-05-09-pc-web-design.md`

- [ ] **Step 1: Update spec status header**

Modify `server/docs/superpowers/specs/2026-05-09-pc-web-design.md`. Update the status line at the top:

```diff
-> 状態: ブレスト完了 / 実装プラン未着手
+> 状態: Phase 1 (Bootstrap) 完了 / Phase 2 計画中
```

- [ ] **Step 2: Final test sweep**

```bash
cd server
npm run test:web
cd packages/gateway && npx vitest run && cd ../..
npx playwright test tests/e2e/web/
```

Expected: all green.

- [ ] **Step 3: Manual smoke test from a clean install**

```bash
cd server && npm run build:gateway && npm run build:web
AUTH_TOKEN=1234 PORT=18765 node packages/gateway/dist/index.js &
GATEWAY_PID=$!
sleep 1
echo "Open http://$(hostname -I | awk '{print $1}'):18765/web in your browser, enter 1234, click a session."
read -p "Press Enter to stop the gateway..."
kill $GATEWAY_PID
```

Expected: Login → Sessions → Terminal works in real browser.

- [ ] **Step 4: Tag the phase**

```bash
cd server
git add docs/superpowers/specs/2026-05-09-pc-web-design.md
git commit -m "$(cat <<'EOF'
docs(web): mark Phase 1 (Bootstrap) complete in PC web spec

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git tag web-pc-phase-1-done
```

- [ ] **Step 5: Push branch (optional, when ready for PR)**

```bash
cd server
git push -u origin feature/web-pc-design-spec
# Or if Phase 1 work was on a dedicated branch like feature/web-pc-phase-1:
# git push -u origin feature/web-pc-phase-1
```

---

## Definition of Done (Phase 1)

- [ ] All Vitest unit/component tests pass (`npm run test:web` from `server/`)
- [ ] All Vitest gateway tests still pass (`cd server/packages/gateway && npx vitest run`)
- [ ] All Playwright E2E tests under `tests/e2e/web/` pass
- [ ] Manual smoke test: open `http://<server>:18765/web`, enter the 4-digit token, see Sessions list, click a session, terminal renders, `echo` produces output
- [ ] `zenterm-gateway info` and `zenterm-gateway qr` print expected output
- [ ] Gateway startup log includes `Web (LAN)` and `Web (Ts)` URL lines
- [ ] No regression in mobile WebView (`/embed/terminal` still serves the original HTML unchanged)
- [ ] No regression in existing `/api/*` and `/ws/*` endpoints

## Out of Phase 1 (deferred to subsequent phases)

- Files / Settings panels
- Bottom nav switching (Files / Settings buttons are placeholders only)
- Light theme + system theme follow (dark only in Phase 1)
- i18n (English-only Phase 1)
- ClaudeLimits / CodexLimits / SystemStatus
- Multi-pane layouts
- Keyboard shortcuts, Command Palette, right-click menus, hover tooltips
- Drag resize for sidebar / panes
- D&D file upload
- URL deep linking (only `/web/login` and `/web/sessions` exist in Phase 1)
- Terminal in-pane search
- Logout UI (handled implicitly via 401 redirect)

These are scoped for Phase 2-5 and will be planned in separate plan documents after Phase 1 lands.
