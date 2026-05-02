import { readFile, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { z } from 'zod';
import type {
  ClaudeAccountStatus,
  ClaudeLimitsResponse,
} from '../types/index.js';

// Inlined to avoid a runtime import of `@zenterm/shared`, which is a
// workspace-only package and isn't resolvable from the published gateway.
const CLAUDE_STATUS_STALE_AFTER_SECONDS = 300;

const windowSchema = z.object({
  used_percentage: z.number().min(0).max(100),
  resets_at: z.number().int().positive(),
});

const fileSchema = z.object({
  schema_version: z.literal(1),
  captured_at: z.number().int().positive(),
  five_hour: windowSchema.nullable().optional(),
  seven_day: windowSchema.nullable().optional(),
  // Optional UI label override. If absent, the loader falls back to the
  // filename stem (or "default" for the legacy single-file path).
  label: z.string().min(1).max(64).optional(),
});

interface ResolvedPaths {
  legacyFile: string;
  multiDir: string;
}

export function getDefaultStatusPaths(): ResolvedPaths {
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
  const root = join(base, 'zenterm');
  return {
    legacyFile: join(root, 'claude-status.json'),
    multiDir: join(root, 'claude-status'),
  };
}

interface ReadOptions {
  legacyFile?: string;
  multiDir?: string;
  now?: number;
  staleAfterSeconds?: number;
}

export async function readClaudeLimits(
  options: ReadOptions = {}
): Promise<ClaudeLimitsResponse> {
  const defaults = getDefaultStatusPaths();
  const legacyFile = options.legacyFile ?? defaults.legacyFile;
  const multiDir = options.multiDir ?? defaults.multiDir;
  const nowSeconds = options.now ?? Math.floor(Date.now() / 1000);
  const staleAfter = options.staleAfterSeconds ?? CLAUDE_STATUS_STALE_AFTER_SECONDS;

  const accounts: ClaudeAccountStatus[] = [];
  let anyFilePresent = false;

  // 1. Legacy single file (default label = "default")
  const legacy = await readSingle(legacyFile, 'default', nowSeconds, staleAfter);
  if (legacy.present) {
    anyFilePresent = true;
    if (legacy.account) accounts.push(legacy.account);
  }

  // 2. Multi-account directory
  let entries: string[] = [];
  try {
    entries = await readdir(multiDir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'ENOTDIR') {
      // Surface unexpected directory read errors as a synthetic unavailable entry
      anyFilePresent = true;
      accounts.push({
        label: basename(multiDir),
        state: 'unavailable',
        reason: 'read_error',
        message: (error as Error).message ?? 'failed to read status directory',
      });
    }
  }

  // Stable order by filename so the UI listing is deterministic.
  entries.sort();
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const filePath = join(multiDir, entry);
    const stem = entry.replace(/\.json$/, '');
    const result = await readSingle(filePath, stem, nowSeconds, staleAfter);
    if (result.present) {
      anyFilePresent = true;
      if (result.account) accounts.push(result.account);
    }
  }

  if (!anyFilePresent) {
    return { state: 'unconfigured' };
  }

  return { state: 'configured', accounts };
}

interface SingleFileResult {
  present: boolean;
  account?: ClaudeAccountStatus;
}

async function readSingle(
  path: string,
  defaultLabel: string,
  nowSeconds: number,
  staleAfter: number
): Promise<SingleFileResult> {
  let raw: string;
  try {
    // Skip directories (e.g., if the legacy path is now a dir or a stem matches a dir)
    const info = await stat(path);
    if (!info.isFile()) {
      return { present: false };
    }
    raw = await readFile(path, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return { present: false };
    }
    return {
      present: true,
      account: {
        label: defaultLabel,
        state: 'unavailable',
        reason: 'read_error',
        message: (error as Error).message ?? 'failed to read status file',
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      present: true,
      account: {
        label: defaultLabel,
        state: 'unavailable',
        reason: 'malformed',
        message: `JSON parse failed: ${(error as Error).message}`,
      },
    };
  }

  const result = fileSchema.safeParse(parsed);
  if (!result.success) {
    return {
      present: true,
      account: {
        label: defaultLabel,
        state: 'unavailable',
        reason: 'malformed',
        message: `schema validation failed: ${result.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      },
    };
  }

  const data = result.data;
  const label = data.label ?? defaultLabel;
  const ageSeconds = Math.max(0, nowSeconds - data.captured_at);
  const stale = ageSeconds > staleAfter;

  const fiveHour = data.five_hour
    ? {
        usedPercentage: data.five_hour.used_percentage,
        resetsAt: data.five_hour.resets_at,
      }
    : undefined;
  const sevenDay = data.seven_day
    ? {
        usedPercentage: data.seven_day.used_percentage,
        resetsAt: data.seven_day.resets_at,
      }
    : undefined;

  if (!fiveHour && !sevenDay) {
    return {
      present: true,
      account: {
        label,
        state: 'pending',
        capturedAt: data.captured_at,
        ageSeconds,
        stale,
      },
    };
  }

  return {
    present: true,
    account: {
      label,
      state: 'ok',
      capturedAt: data.captured_at,
      ageSeconds,
      stale,
      fiveHour,
      sevenDay,
    },
  };
}
