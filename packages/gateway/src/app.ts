import fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import websocket from '@fastify/websocket';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import bearerPlugin from './auth/bearer.js';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import embedRoutes from './routes/embed.js';
import sessionRoutes from './routes/sessions.js';
import terminalRoutes from './routes/terminal.js';
import fileRoutes from './routes/files.js';
import systemRoutes from './routes/system.js';
import uploadRoutes from './routes/upload.js';
import { FilesystemError } from './services/filesystem.js';
import { TmuxServiceError } from './services/tmux.js';

const thisDir = fileURLToPath(new URL('.', import.meta.url));
const publicDir = resolve(thisDir, '..', 'public');

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

    if (error instanceof FilesystemError) {
      request.log.error({ err: error, code: error.code }, 'filesystem operation failed');
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
  await app.register(multipart, {
    limits: { fileSize: config.UPLOAD_MAX_SIZE }
  });

  app.get('/health', async () => ({ ok: true }));

  app.get('/', async (_request, reply) => {
    reply.type('text/html; charset=utf-8');
    reply.header('Cache-Control', 'public, max-age=3600');
    return reply.sendFile('index.html');
  });

  // SPA: serve app/index.html for client-side routes (not static assets)
  app.get('/app', async (_request, reply) => {
    reply.redirect('/app/');
  });
  app.get('/app/*', async (request, reply) => {
    // Let static plugin handle actual files (js, css, etc.)
    const path = request.url.replace(/\?.*$/, '');
    if (path.match(/\.\w+$/)) {
      // Has a file extension — let Fastify's static plugin handle it (will 404 if not found)
      return reply.sendFile(path.slice(1)); // remove leading /
    }
    // No file extension — serve SPA index for client-side routing
    reply.type('text/html; charset=utf-8');
    reply.header('Cache-Control', 'no-store');
    return reply.sendFile('app/index.html');
  });

  await app.register(embedRoutes);
  await app.register(terminalRoutes);
  await app.register(authRoutes);
  await app.register(sessionRoutes);
  await app.register(systemRoutes);
  await app.register(fileRoutes);
  await app.register(uploadRoutes);

  return app;
}

export default buildApp;
