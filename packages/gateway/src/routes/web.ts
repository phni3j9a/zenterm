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

  // Root-level static files emitted from packages/web/public/. These must be
  // served as real files; otherwise the /web/* SPA fallback below would return
  // index.html and the browser would fail to load the icon.
  fastify.get('/web/favicon.ico', async (_request, reply) => {
    return reply.sendFile('web/favicon.ico');
  });

  fastify.get('/web/apple-touch-icon.png', async (_request, reply) => {
    return reply.sendFile('web/apple-touch-icon.png');
  });

  // /web/* → SPA fallback (any nested client-routed path returns index.html)
  fastify.get('/web/*', async (_request, reply) => {
    reply.type('text/html; charset=utf-8');
    reply.header('Cache-Control', 'no-store');
    return reply.sendFile('web/index.html');
  });
};

export default webRoutes;
