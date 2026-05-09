import type { FastifyPluginAsync } from 'fastify';

const webRoutes: FastifyPluginAsync = async (fastify) => {
  // /web → index.html
  fastify.get('/web', async (_request, reply) => {
    reply.type('text/html; charset=utf-8');
    reply.header('Cache-Control', 'no-store');
    return reply.sendFile('web/index.html');
  });

  // /web/* → SPA fallback (any nested path returns index.html for client routing)
  fastify.get('/web/*', async (request, reply) => {
    const path = (request.params as { '*': string })['*'];
    // Don't fallback for /web/assets/* — staticPlugin already serves those
    if (path.startsWith('assets/')) {
      reply.callNotFound();
      return;
    }
    reply.type('text/html; charset=utf-8');
    reply.header('Cache-Control', 'no-store');
    return reply.sendFile('web/index.html');
  });
};

export default webRoutes;
