import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import {
  CLAUDE_STATUS_STALE_AFTER_SECONDS,
  type ClaudeLimitsResponse,
} from '../types/index.js';

const windowSchema = z.object({
  used_percentage: z.number().min(0).max(100),
  resets_at: z.number().int().positive(),
});

const fileSchema = z.object({
  schema_version: z.literal(1),
  captured_at: z.number().int().positive(),
  five_hour: windowSchema.nullable().optional(),
  seven_day: windowSchema.nullable().optional(),
});

export function getDefaultStatusFilePath(): string {
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
  return join(base, 'zenterm', 'claude-status.json');
}

interface ReadOptions {
  path?: string;
  now?: number;
  staleAfterSeconds?: number;
}

export async function readClaudeLimits(
  options: ReadOptions = {}
): Promise<ClaudeLimitsResponse> {
  const path = options.path ?? getDefaultStatusFilePath();
  const nowSeconds = options.now ?? Math.floor(Date.now() / 1000);
  const staleAfter = options.staleAfterSeconds ?? CLAUDE_STATUS_STALE_AFTER_SECONDS;

  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return { state: 'unconfigured' };
    }
    return {
      state: 'unavailable',
      reason: 'read_error',
      message: (error as Error).message ?? 'failed to read status file',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      state: 'unavailable',
      reason: 'malformed',
      message: `JSON parse failed: ${(error as Error).message}`,
    };
  }

  const result = fileSchema.safeParse(parsed);
  if (!result.success) {
    return {
      state: 'unavailable',
      reason: 'malformed',
      message: `schema validation failed: ${result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    };
  }

  const data = result.data;
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
      state: 'pending',
      capturedAt: data.captured_at,
      ageSeconds,
      stale,
    };
  }

  return {
    state: 'ok',
    capturedAt: data.captured_at,
    ageSeconds,
    stale,
    fiveHour,
    sevenDay,
  };
}
