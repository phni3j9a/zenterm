import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  captureScrollback,
  captureWindowScrollback,
  createSession,
  createWindow,
  killSession,
  killWindow,
  listSessions,
  listWindows,
  renameSession,
  renameWindow,
  toggleWindowZoom
} from '../services/tmux.js';

const createSessionSchema = z
  .object({
    name: z.string().trim().min(1).max(64).optional()
  })
  .strict();

const renameSessionSchema = z
  .object({
    name: z.string().trim().min(1).max(64)
  })
  .strict();

const sessionParamsSchema = z.object({
  sessionId: z.string().trim().min(1).max(64)
});

const createWindowSchema = z
  .object({
    name: z.string().trim().min(1).max(64).optional()
  })
  .strict();

const renameWindowSchema = z
  .object({
    name: z.string().trim().min(1).max(64)
  })
  .strict();

const windowParamsSchema = z.object({
  sessionId: z.string().trim().min(1).max(64),
  windowIndex: z.coerce.number().int().min(0).max(999)
});

const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/sessions', async () => listSessions());

  fastify.post('/api/sessions', async (request, reply) => {
    const body = createSessionSchema.parse(request.body ?? {});
    const session = createSession(body.name);

    request.log.info({ session: session.name }, 'tmux session created');
    return reply.status(201).send(session);
  });

  fastify.patch('/api/sessions/:sessionId', async (request) => {
    const params = sessionParamsSchema.parse(request.params);
    const body = renameSessionSchema.parse(request.body ?? {});
    const session = renameSession(params.sessionId, body.name);

    request.log.info({ from: params.sessionId, to: session.name }, 'tmux session renamed');
    return session;
  });

  fastify.delete('/api/sessions/:sessionId', async (request) => {
    const params = sessionParamsSchema.parse(request.params);
    killSession(params.sessionId);

    request.log.info({ session: params.sessionId }, 'tmux session deleted');
    return { ok: true };
  });

  fastify.get('/api/sessions/:sessionId/scrollback', async (request) => {
    const params = sessionParamsSchema.parse(request.params);
    const content = captureScrollback(params.sessionId);
    return { content };
  });

  // ─── Window routes ───

  fastify.get('/api/sessions/:sessionId/windows', async (request) => {
    const params = sessionParamsSchema.parse(request.params);
    return listWindows(params.sessionId);
  });

  fastify.post('/api/sessions/:sessionId/windows', async (request, reply) => {
    const params = sessionParamsSchema.parse(request.params);
    const body = createWindowSchema.parse(request.body ?? {});
    const window = createWindow(params.sessionId, body.name);

    request.log.info(
      { session: params.sessionId, window: window.name },
      'tmux window created'
    );
    return reply.status(201).send(window);
  });

  fastify.patch('/api/sessions/:sessionId/windows/:windowIndex', async (request) => {
    const params = windowParamsSchema.parse(request.params);
    const body = renameWindowSchema.parse(request.body ?? {});
    const window = renameWindow(params.sessionId, params.windowIndex, body.name);

    request.log.info(
      { session: params.sessionId, window: params.windowIndex, name: window.name },
      'tmux window renamed'
    );
    return window;
  });

  fastify.delete('/api/sessions/:sessionId/windows/:windowIndex', async (request) => {
    const params = windowParamsSchema.parse(request.params);
    killWindow(params.sessionId, params.windowIndex);

    request.log.info(
      { session: params.sessionId, window: params.windowIndex },
      'tmux window deleted'
    );
    return { ok: true };
  });

  fastify.post('/api/sessions/:sessionId/windows/:windowIndex/zoom', async (request) => {
    const params = windowParamsSchema.parse(request.params);
    const window = toggleWindowZoom(params.sessionId, params.windowIndex);

    request.log.info(
      { session: params.sessionId, window: params.windowIndex, zoomed: window.zoomed },
      'tmux window zoom toggled'
    );
    return window;
  });

  fastify.get('/api/sessions/:sessionId/windows/:windowIndex/scrollback', async (request) => {
    const params = windowParamsSchema.parse(request.params);
    const content = captureWindowScrollback(params.sessionId, params.windowIndex);
    return { content };
  });
};

export default sessionRoutes;
