import type { FastifyPluginAsync } from 'fastify';

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' ws: wss:",
  "font-src 'self'",
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'"
].join('; ');

const embedRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/embed/terminal', async (_request, reply) => {
    reply.type('text/html; charset=utf-8');
    reply.header('Content-Security-Policy', CSP);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Cache-Control', 'no-store');
    return reply.sendFile('terminal/index.html');
  });
};

export default embedRoutes;
