import crypto from 'node:crypto';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { config } from '../config.js';

const publicExactPaths = new Set([
  '/',
  '/index.html',
  '/embed/terminal',
  '/health',
  '/web',
  '/ws/events',
  '/ws/terminal',
]);

function getPathname(url?: string): string {
  return new URL(url ?? '/', 'http://localhost').pathname;
}

function isPublicPath(pathname: string): boolean {
  if (publicExactPaths.has(pathname)) return true;
  if (pathname.startsWith('/terminal/lib/')) return true;
  if (pathname.startsWith('/lp/')) return true;
  if (pathname.startsWith('/web/')) return true;
  return false;
}

function verifyToken(token: string): boolean {
  const expected = Buffer.from(config.AUTH_TOKEN);
  const actual = Buffer.from(token);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

const bearerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    const pathname = getPathname(request.raw.url);
    if (isPublicPath(pathname)) {
      return;
    }

    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
      return;
    }

    const token = header.slice(7).trim();
    if (!verifyToken(token)) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Invalid token' });
      return;
    }
  });
};

export default fp(bearerPlugin, { name: 'bearer-auth' });
