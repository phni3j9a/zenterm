import {
  copyFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentType = 'claude-code' | 'codex' | 'copilot-cli';
type AgentTypeOrUnknown = AgentType | 'unknown';

interface InstallResult {
  success: boolean;
  agent: AgentType;
  configPath: string;
  message: string;
  backedUp?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOME = process.env.HOME ?? '';
const MARKER = 'zenterm-managed';

const CONFIG_PATHS: Record<AgentType, string> = {
  'claude-code': join(HOME, '.claude', 'settings.json'),
  codex: join(HOME, '.codex', 'config.toml'),
  'copilot-cli': join(HOME, '.copilot', 'config.json'),
};

// ---------------------------------------------------------------------------
// Hooks directory helpers
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

/** User-local directory where hook scripts are deployed at runtime. */
export function getHooksDir(): string {
  return join(HOME, '.config', 'zenterm', 'hooks');
}

/**
 * Resolve the source hooks directory.
 * Search order:
 *   1. <dist>/../src/hooks  (npm-published package: src/hooks is in "files")
 *   2. <dist>/../hooks      (legacy fallback)
 *   3. <__dirname>/../../src/hooks (tsx dev: __dirname = src/services)
 */
function resolveHooksSourceDir(): string | null {
  const candidates = [
    resolve(__dirname, '..', '..', 'src', 'hooks'),  // published package OR tsx dev
    resolve(__dirname, '..', 'hooks'),                // legacy fallback
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return null;
}

/** Copy every hook script from the package into the user hooks dir. */
function deployHookScripts(): void {
  const dest = getHooksDir();
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const sourceDir = resolveHooksSourceDir();
  if (!sourceDir) {
    return;
  }

  for (const file of readdirSync(sourceDir)) {
    if (!file.endsWith('.sh')) continue;
    const src = join(sourceDir, file);
    const dst = join(dest, file);
    copyFileSync(src, dst);
    chmodSync(dst, 0o755);
  }
}

// ---------------------------------------------------------------------------
// Backup helper
// ---------------------------------------------------------------------------

function backup(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  writeFileSync(`${filePath}.bak`, readFileSync(filePath));
  return true;
}

// ---------------------------------------------------------------------------
// JSON helpers (Claude Code / Copilot CLI)
// ---------------------------------------------------------------------------

function readJson(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function writeJson(filePath: string, data: unknown): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Claude Code
// ---------------------------------------------------------------------------

function buildClaudeHookEntry(
  authToken: string,
  port: number,
  eventType: string,
): Record<string, unknown> {
  const hooksDir = getHooksDir();
  return {
    matcher: '',
    hooks: [
      {
        type: 'command',
        command: `ZENTERM_AUTH_TOKEN=${authToken} ZENTERM_GATEWAY_URL=http://127.0.0.1:${port} ${hooksDir}/zenterm-notify.sh claude-code ${eventType}`,
        timeout: 10,
      },
    ],
    description: 'ZenTerm notification hook',
    id: MARKER,
    _marker: MARKER,
  };
}

function installClaudeCode(authToken: string, port: number): InstallResult {
  const configPath = CONFIG_PATHS['claude-code'];

  try {
    let data = readJson(configPath);
    const fileExisted = data !== null;

    if (fileExisted && data === null) {
      return {
        success: false,
        agent: 'claude-code',
        configPath,
        message: 'Failed to parse existing settings.json — aborting to avoid data loss',
      };
    }

    const backedUp = backup(configPath);
    if (!data) data = {};

    // Ensure hooks object
    const hooks = (data.hooks ?? {}) as Record<string, unknown>;

    // --- Stop ---
    const stopArr = Array.isArray(hooks.Stop) ? (hooks.Stop as unknown[]) : [];
    // Remove existing zenterm entries
    const filteredStop = stopArr.filter(
      (entry) => !(entry && typeof entry === 'object' && (entry as Record<string, unknown>)._marker === MARKER),
    );
    filteredStop.push(buildClaudeHookEntry(authToken, port, 'task.completed'));
    hooks.Stop = filteredStop;

    // --- Notification ---
    const notifArr = Array.isArray(hooks.Notification) ? (hooks.Notification as unknown[]) : [];
    const filteredNotif = notifArr.filter(
      (entry) => !(entry && typeof entry === 'object' && (entry as Record<string, unknown>)._marker === MARKER),
    );
    filteredNotif.push(buildClaudeHookEntry(authToken, port, 'input.requested'));
    hooks.Notification = filteredNotif;

    data.hooks = hooks;
    writeJson(configPath, data);

    return {
      success: true,
      agent: 'claude-code',
      configPath,
      message: 'Hooks added to Stop and Notification in settings.json',
      backedUp,
    };
  } catch (err) {
    return {
      success: false,
      agent: 'claude-code',
      configPath,
      message: `Install failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function uninstallClaudeCode(): InstallResult {
  const configPath = CONFIG_PATHS['claude-code'];

  try {
    const data = readJson(configPath);
    if (!data) {
      return { success: true, agent: 'claude-code', configPath, message: 'Config not found — nothing to remove' };
    }

    const backedUp = backup(configPath);
    const hooks = (data.hooks ?? {}) as Record<string, unknown[]>;

    for (const event of ['Stop', 'Notification']) {
      if (!Array.isArray(hooks[event])) continue;
      hooks[event] = hooks[event].filter(
        (entry) => !(entry && typeof entry === 'object' && (entry as Record<string, unknown>)._marker === MARKER),
      );
    }

    data.hooks = hooks;
    writeJson(configPath, data);

    return {
      success: true,
      agent: 'claude-code',
      configPath,
      message: 'ZenTerm hooks removed from settings.json',
      backedUp,
    };
  } catch (err) {
    return {
      success: false,
      agent: 'claude-code',
      configPath,
      message: `Uninstall failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function isClaudeCodeInstalled(): boolean {
  const data = readJson(CONFIG_PATHS['claude-code']);
  if (!data) return false;
  const hooks = data.hooks as Record<string, unknown[]> | undefined;
  if (!hooks) return false;
  return ['Stop', 'Notification'].some((event) =>
    Array.isArray(hooks[event]) &&
    hooks[event].some(
      (e) => e && typeof e === 'object' && (e as Record<string, unknown>)._marker === MARKER,
    ),
  );
}

// ---------------------------------------------------------------------------
// Codex (TOML — text-only manipulation)
// ---------------------------------------------------------------------------

function buildCodexNotifyLine(): string {
  const hooksDir = getHooksDir();
  return `notify = ["/bin/bash", "${hooksDir}/codex-notify.sh"]  # ${MARKER}`;
}

function installCodex(_authToken: string, _port: number): InstallResult {
  const configPath = CONFIG_PATHS.codex;

  try {
    const backedUp = backup(configPath);
    let lines: string[];

    if (existsSync(configPath)) {
      lines = readFileSync(configPath, 'utf8').split('\n');
    } else {
      const dir = dirname(configPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      lines = [];
    }

    // Remove any existing notify line
    lines = lines.filter((l) => !/^\s*notify\s*=/u.test(l));

    // Insert before the first [section] header so it stays at the top level.
    const notifyLine = buildCodexNotifyLine();
    const sectionIdx = lines.findIndex((l) => /^\s*\[/u.test(l));
    if (sectionIdx === -1) {
      lines.push(notifyLine);
    } else {
      lines.splice(sectionIdx, 0, notifyLine);
    }

    writeFileSync(configPath, lines.join('\n'), 'utf8');

    return {
      success: true,
      agent: 'codex',
      configPath,
      message: 'notify line added to config.toml',
      backedUp,
    };
  } catch (err) {
    return {
      success: false,
      agent: 'codex',
      configPath,
      message: `Install failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function uninstallCodex(): InstallResult {
  const configPath = CONFIG_PATHS.codex;

  try {
    if (!existsSync(configPath)) {
      return { success: true, agent: 'codex', configPath, message: 'Config not found — nothing to remove' };
    }

    const backedUp = backup(configPath);
    const lines = readFileSync(configPath, 'utf8').split('\n');
    const filtered = lines.filter((l) => !l.includes(MARKER));
    writeFileSync(configPath, filtered.join('\n'), 'utf8');

    return {
      success: true,
      agent: 'codex',
      configPath,
      message: 'ZenTerm notify line removed from config.toml',
      backedUp,
    };
  } catch (err) {
    return {
      success: false,
      agent: 'codex',
      configPath,
      message: `Uninstall failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function isCodexInstalled(): boolean {
  const configPath = CONFIG_PATHS.codex;
  if (!existsSync(configPath)) return false;
  return readFileSync(configPath, 'utf8').includes(MARKER);
}

// ---------------------------------------------------------------------------
// Copilot CLI
// ---------------------------------------------------------------------------

function installCopilotCli(authToken: string, port: number): InstallResult {
  const configPath = CONFIG_PATHS['copilot-cli'];
  const hooksDir = getHooksDir();

  try {
    let data = readJson(configPath);
    const fileExisted = existsSync(configPath);

    if (fileExisted && data === null) {
      return {
        success: false,
        agent: 'copilot-cli',
        configPath,
        message: 'Failed to parse existing config.json — aborting to avoid data loss',
      };
    }

    const backedUp = backup(configPath);
    if (!data) data = {};

    const hooks = (data.hooks ?? {}) as Record<string, unknown>;

    // --- SessionEnd ---
    const arr = Array.isArray(hooks.SessionEnd) ? (hooks.SessionEnd as unknown[]) : [];
    const filtered = arr.filter(
      (entry) => !(entry && typeof entry === 'object' && (entry as Record<string, unknown>)._marker === MARKER),
    );
    filtered.push({
      type: 'command',
      command: [
        `ZENTERM_AUTH_TOKEN=${authToken}`,
        `ZENTERM_GATEWAY_URL=http://127.0.0.1:${port}`,
        `${hooksDir}/zenterm-notify.sh copilot-cli task.completed`,
      ].join(' '),
      _marker: MARKER,
    });
    hooks.SessionEnd = filtered;

    data.hooks = hooks;
    writeJson(configPath, data);

    return {
      success: true,
      agent: 'copilot-cli',
      configPath,
      message: 'SessionEnd hook added to config.json',
      backedUp,
    };
  } catch (err) {
    return {
      success: false,
      agent: 'copilot-cli',
      configPath,
      message: `Install failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function uninstallCopilotCli(): InstallResult {
  const configPath = CONFIG_PATHS['copilot-cli'];

  try {
    const data = readJson(configPath);
    if (!data) {
      return { success: true, agent: 'copilot-cli', configPath, message: 'Config not found — nothing to remove' };
    }

    const backedUp = backup(configPath);
    const hooks = (data.hooks ?? {}) as Record<string, unknown[]>;

    if (Array.isArray(hooks.SessionEnd)) {
      hooks.SessionEnd = hooks.SessionEnd.filter(
        (entry) => !(entry && typeof entry === 'object' && (entry as Record<string, unknown>)._marker === MARKER),
      );
    }

    data.hooks = hooks;
    writeJson(configPath, data);

    return {
      success: true,
      agent: 'copilot-cli',
      configPath,
      message: 'ZenTerm hooks removed from config.json',
      backedUp,
    };
  } catch (err) {
    return {
      success: false,
      agent: 'copilot-cli',
      configPath,
      message: `Uninstall failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function isCopilotCliInstalled(): boolean {
  const data = readJson(CONFIG_PATHS['copilot-cli']);
  if (!data) return false;
  const hooks = data.hooks as Record<string, unknown[]> | undefined;
  if (!hooks || !Array.isArray(hooks.SessionEnd)) return false;
  return hooks.SessionEnd.some(
    (e) => e && typeof e === 'object' && (e as Record<string, unknown>)._marker === MARKER,
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function installIntegration(agent: AgentType, authToken: string, port: number): InstallResult {
  deployHookScripts();

  switch (agent) {
    case 'claude-code':
      return installClaudeCode(authToken, port);
    case 'codex':
      return installCodex(authToken, port);
    case 'copilot-cli':
      return installCopilotCli(authToken, port);
    default:
      return {
        success: false,
        agent,
        configPath: '',
        message: `Unknown agent: ${agent as string}`,
      };
  }
}

export function uninstallIntegration(agent: AgentType): InstallResult {
  switch (agent) {
    case 'claude-code':
      return uninstallClaudeCode();
    case 'codex':
      return uninstallCodex();
    case 'copilot-cli':
      return uninstallCopilotCli();
    default:
      return {
        success: false,
        agent,
        configPath: '',
        message: `Unknown agent: ${agent as string}`,
      };
  }
}

export function isInstalled(agent: AgentType): boolean {
  switch (agent) {
    case 'claude-code':
      return isClaudeCodeInstalled();
    case 'codex':
      return isCodexInstalled();
    case 'copilot-cli':
      return isCopilotCliInstalled();
    default:
      return false;
  }
}

/**
 * Convenience wrapper used by existing routes — reads authToken/port from
 * the gateway config so callers only need to pass the agent type.
 * Accepts the broader shared AgentType (which includes 'unknown').
 */
export function installHook(agent: string): InstallResult {
  if (!isKnownAgent(agent)) {
    return { success: false, agent: agent as AgentType, configPath: '', message: `Unknown agent: ${agent}` };
  }
  const { authToken, port } = resolveConfig();
  return installIntegration(agent, authToken, port);
}

export function uninstallHook(agent: string): InstallResult {
  if (!isKnownAgent(agent)) {
    return { success: false, agent: agent as AgentType, configPath: '', message: `Unknown agent: ${agent}` };
  }
  return uninstallIntegration(agent);
}

function isKnownAgent(agent: string): agent is AgentType {
  return agent === 'claude-code' || agent === 'codex' || agent === 'copilot-cli';
}

/** Read config values from env to avoid circular-dependency at module load. */
function resolveConfig(): { authToken: string; port: number } {
  return {
    authToken: process.env.AUTH_TOKEN ?? '',
    port: Number(process.env.PORT) || 18765,
  };
}

export type { AgentType, InstallResult };
