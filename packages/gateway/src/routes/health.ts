import type { FastifyPluginAsync } from 'fastify';
import { execFileSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';

interface HealthCheck {
  status: 'ok' | 'error';
  message?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  checks: {
    tmux: HealthCheck;
    filesystem: HealthCheck;
  };
  uptime: number;
  timestamp: string;
}

function checkTmux(): HealthCheck {
  try {
    execFileSync('tmux', ['list-sessions'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
    });
    return { status: 'ok' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // "no server running" は正常（セッションがないだけ）
    if (message.includes('no server running') || message.includes('no sessions')) {
      return { status: 'ok' };
    }

    return { status: 'error', message };
  }
}

function checkFilesystem(): HealthCheck {
  const homeDir = process.env.HOME ?? process.cwd();

  try {
    accessSync(homeDir, constants.R_OK);
    return { status: 'ok' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Cannot access home directory'
    };
  }
}

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    const rawChecks = {
      tmux: checkTmux(),
      filesystem: checkFilesystem()
    };
    const hasError = Object.values(rawChecks).some((check) => check.status === 'error');

    // エラーメッセージを外部に漏洩させない
    const sanitizedChecks = Object.fromEntries(
      Object.entries(rawChecks).map(([key, check]) => [
        key,
        check.status === 'error'
          ? { status: 'error' as const }
          : check
      ])
    );

    const response: HealthResponse = {
      status: hasError ? 'degraded' : 'ok',
      checks: sanitizedChecks as HealthResponse['checks'],
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    // 異常時は 503 を返す
    const statusCode = hasError ? 503 : 200;
    return reply.status(statusCode).send(response);
  });
};

export default healthRoutes;
