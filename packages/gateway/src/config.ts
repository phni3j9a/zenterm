import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';

const envPath = resolve(process.cwd(), '.env');

function loadEnvFile(): void {
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, 'utf8');

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile();

const configSchema = z.object({
  AUTH_TOKEN: z.string().min(1, 'AUTH_TOKEN is required'),
  PORT: z.coerce.number().int().positive().default(18765),
  HOST: z.string().min(1).default('0.0.0.0'),
  SESSION_PREFIX: z.string().min(1).default('psh_'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  UPLOAD_DIR: z
    .string()
    .min(1)
    .default(join(process.env.HOME ?? '', 'uploads', 'palmsh')),
  UPLOAD_MAX_SIZE: z.coerce.number().int().positive().default(10 * 1024 * 1024)
});

const parsedConfig = configSchema.safeParse(process.env);

if (!parsedConfig.success) {
  const details = parsedConfig.error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join(', ');

  throw new Error(`Invalid environment configuration: ${details}`);
}

export const config = parsedConfig.data;

export type Config = typeof config;
