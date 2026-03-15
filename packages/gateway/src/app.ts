import fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import websocket from '@fastify/websocket';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import bearerPlugin from './auth/bearer.js';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import embedRoutes from './routes/embed.js';
import sessionRoutes from './routes/sessions.js';
import terminalRoutes from './routes/terminal.js';
import { TmuxServiceError } from './services/tmux.js';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));

function redactTokenFromUrl(url: string): string {
  return url.replace(/([?&])token=[^&]*/g, '$1token=***');
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: {
      level: config.LOG_LEVEL,
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: redactTokenFromUrl(request.url ?? ''),
            hostname: request.hostname,
            remoteAddress: request.ip
          };
        }
      }
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      reply.status(400).send({
        error: 'Bad Request',
        message: 'リクエストが不正です。',
        issues: error.flatten()
      });
      return;
    }

    if (error instanceof TmuxServiceError) {
      request.log.error({ err: error, code: error.code }, 'tmux operation failed');
      reply.status(error.statusCode).send({
        error: error.code,
        message: error.message
      });
      return;
    }

    const genericError = error instanceof Error ? error : new Error('Internal Server Error');
    const rawStatusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? error.statusCode
        : undefined;
    const statusCode =
      typeof rawStatusCode === 'number' && rawStatusCode >= 400 ? rawStatusCode : 500;

    if (statusCode >= 500) {
      request.log.error({ err: error }, 'request failed');
    } else {
      request.log.warn({ err: error }, 'request failed');
    }

    reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal Server Error' : genericError.name,
      message: genericError.message
    });
  });

  await app.register(cors, {
    origin: true
  });

  await app.register(websocket, {
    options: { maxPayload: 64 * 1024 } // 64KB max WebSocket frame
  });
  await app.register(bearerPlugin);
  await app.register(staticPlugin, {
    root: join(publicDir)
  });

  app.get('/health', async () => ({ ok: true }));

  await app.register(embedRoutes);
  await app.register(terminalRoutes);
  await app.register(authRoutes);
  await app.register(sessionRoutes);

  return app;
}

export default buildApp;
