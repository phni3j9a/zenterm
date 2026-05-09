import type { FastifyPluginAsync } from 'fastify';

const webRoutes: FastifyPluginAsync = async (fastify) => {
  // /web → index.html
  fastify.get('/web', async (_request, reply) => {
    reply.type('text/html; charset=utf-8');
    reply.header('Cache-Control', 'no-store');
    return reply.sendFile('web/index.html');
  });

  // /web/assets/* → serve static assets directly (CSS, JS, source maps, etc.)
  fastify.get('/web/assets/*', async (request, reply) => {
    const path = (request.params as { '*': string })['*'];
    return reply.sendFile(`web/assets/${path}`);
  });

  // /web/* → SPA fallback (any nested client-routed path returns index.html)
  fastify.get('/web/*', async (_request, reply) => {
    reply.type('text/html; charset=utf-8');
    reply.header('Cache-Control', 'no-store');
    return reply.sendFile('web/index.html');
  });
};

export default webRoutes;
