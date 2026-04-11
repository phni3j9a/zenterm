import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createSession, killSession, listSessions, renameSession, captureScrollback } from '../services/tmux.js';

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
};

export default sessionRoutes;
