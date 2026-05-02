import { readFile, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type {
  CodexAccountStatus,
  CodexLimitsResponse,
} from '../types/index.js';

const CODEX_STATUS_STALE_AFTER_SECONDS = 300;
const SCAN_DAYS_BACK = 7;

const rateLimitWindowSchema = z.object({
  used_percent: z.number().min(0).max(100),
  window_minutes: z.number().int().positive(),
  resets_at: z.number().int().positive(),
});

const tokenCountEventSchema = z.object({
  timestamp: z.string(),
  type: z.literal('event_msg'),
  payload: z.object({
    type: z.literal('token_count'),
    rate_limits: z
      .object({
        primary: rateLimitWindowSchema.nullish(),
        secondary: rateLimitWindowSchema.nullish(),
        plan_type: z.string().nullish(),
      })
      .optional(),
  }),
});

type TokenCountEvent = z.infer<typeof tokenCountEventSchema>;

interface ResolvedPaths {
  codexHome: string;
  sessionsDir: string;
}

export function getDefaultCodexPaths(): ResolvedPaths {
  const home = process.env.CODEX_HOME ?? join(homedir(), '.codex');
  return {
    codexHome: home,
    sessionsDir: join(home, 'sessions'),
  };
}

interface ReadOptions {
  codexHome?: string;
  now?: number;
  staleAfterSeconds?: number;
  scanDaysBack?: number;
}

export async function readCodexLimits(
  options: ReadOptions = {}
): Promise<CodexLimitsResponse> {
  const defaults = getDefaultCodexPaths();
  const codexHome = options.codexHome ?? defaults.codexHome;
  const sessionsDir = join(codexHome, 'sessions');
  const nowSeconds = options.now ?? Math.floor(Date.now() / 1000);
  const staleAfter =
    options.staleAfterSeconds ?? CODEX_STATUS_STALE_AFTER_SECONDS;
  const scanDays = options.scanDaysBack ?? SCAN_DAYS_BACK;
  const label = 'default';

  // 1. Codex home directory must exist; otherwise treat as not configured
  try {
    const info = await stat(codexHome);
    if (!info.isDirectory()) {
      return { state: 'unconfigured' };
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return { state: 'unconfigured' };
    }
    return wrapUnavailable(label, error);
  }

  // 2. Find recent session files (.jsonl), newest first
  let sessionFiles: { path: string; mtime: number }[];
  try {
    sessionFiles = await findRecentSessionFiles(
      sessionsDir,
      scanDays,
      nowSeconds * 1000
    );
  } catch (error) {
    return wrapUnavailable(label, error);
  }

  if (sessionFiles.length === 0) {
    return {
      state: 'configured',
      accounts: [
        {
          label,
          state: 'pending',
          message: `No Codex session files in the last ${scanDays} days.`,
        },
      ],
    };
  }

  // 3. Walk newest session first; find latest token_count with rate_limits
  for (const file of sessionFiles) {
    const event = await findLatestTokenCount(file.path);
    if (!event) continue;
    const rl = event.payload.rate_limits;
    if (!rl) continue;

    const capturedAt = isoToEpoch(event.timestamp);
    if (capturedAt == null) continue;

    const ageSeconds = Math.max(0, nowSeconds - capturedAt);
    const stale = ageSeconds > staleAfter;

    const fiveHour = mapWindow(rl.primary ?? null);
    const sevenDay = mapWindow(rl.secondary ?? null);
    const planType = rl.plan_type ?? undefined;

    const account: CodexAccountStatus = {
      label,
      state: 'ok',
      capturedAt,
      ageSeconds,
      stale,
      ...(planType ? { planType } : {}),
      ...(fiveHour ? { fiveHour } : {}),
      ...(sevenDay ? { sevenDay } : {}),
    };

    return { state: 'configured', accounts: [account] };
  }

  return {
    state: 'configured',
    accounts: [
      {
        label,
        state: 'pending',
        message: 'No rate_limits captured yet in recent Codex sessions.',
      },
    ],
  };
}

function wrapUnavailable(label: string, error: unknown): CodexLimitsResponse {
  return {
    state: 'configured',
    accounts: [
      {
        label,
        state: 'unavailable',
        reason: 'read_error',
        message:
          error instanceof Error
            ? error.message
            : 'failed to read Codex sessions',
      },
    ],
  };
}

function mapWindow(
  w: { used_percent: number; resets_at: number } | null | undefined
) {
  if (!w) return null;
  return { usedPercentage: w.used_percent, resetsAt: w.resets_at };
}

function isoToEpoch(iso: string): number | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor(t / 1000);
}

async function findRecentSessionFiles(
  sessionsDir: string,
  maxDays: number,
  nowMs: number
): Promise<{ path: string; mtime: number }[]> {
  const cutoff = nowMs - maxDays * 24 * 60 * 60 * 1000;
  const files: { path: string; mtime: number }[] = [];

  let years: string[];
  try {
    years = await readdir(sessionsDir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return [];
    throw error;
  }

  for (const year of years) {
    if (!/^\d{4}$/.test(year)) continue;
    const yearDir = join(sessionsDir, year);
    let months: string[];
    try {
      months = await readdir(yearDir);
    } catch {
      continue;
    }

    for (const month of months) {
      if (!/^\d{2}$/.test(month)) continue;
      const monthDir = join(yearDir, month);
      let days: string[];
      try {
        days = await readdir(monthDir);
      } catch {
        continue;
      }

      for (const day of days) {
        if (!/^\d{2}$/.test(day)) continue;
        const dayDir = join(monthDir, day);
        let entries: string[];
        try {
          entries = await readdir(dayDir);
        } catch {
          continue;
        }

        for (const entry of entries) {
          if (!entry.endsWith('.jsonl')) continue;
          const filePath = join(dayDir, entry);
          try {
            const s = await stat(filePath);
            if (s.mtimeMs >= cutoff) {
              files.push({ path: filePath, mtime: s.mtimeMs });
            }
          } catch {
            continue;
          }
        }
      }
    }
  }

  files.sort((a, b) => b.mtime - a.mtime);
  return files;
}

async function findLatestTokenCount(
  filePath: string
): Promise<TokenCountEvent | null> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
  const lines = content.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line || !line.includes('token_count')) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    const result = tokenCountEventSchema.safeParse(parsed);
    if (!result.success) continue;
    if (!result.data.payload.rate_limits) continue;
    return result.data;
  }
  return null;
}
