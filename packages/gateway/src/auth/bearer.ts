import bearerAuth from '@fastify/bearer-auth';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    requireBearerAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const publicExactPaths = new Set([
  '/',
  '/index.html',
  '/embed/terminal',
  '/health',
  '/ws/terminal',
]);

function getPathname(url?: string): string {
  return new URL(url ?? '/', 'http://localhost').pathname;
}

function isPublicPath(pathname: string): boolean {
  if (publicExactPaths.has(pathname)) return true;
  if (pathname.startsWith('/terminal/lib/')) return true;
  return false;
}

const bearerPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(bearerAuth, {
    addHook: false,
    keys: new Set([config.AUTH_TOKEN]),
    verifyErrorLogLevel: config.LOG_LEVEL === 'debug' ? 'debug' : 'error'
  });

  const verifyBearerAuth = fastify.verifyBearerAuth;
  if (!verifyBearerAuth) {
    throw new Error('verifyBearerAuth decorator is not available');
  }

  fastify.decorate('requireBearerAuth', async (request, reply) => {
    await new Promise<void>((resolve, reject) => {
      verifyBearerAuth(request, reply, (error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  fastify.addHook('onRequest', async (request, reply) => {
    const pathname = getPathname(request.raw.url);
    if (isPublicPath(pathname)) {
      return;
    }

    await fastify.requireBearerAuth(request, reply);
  });
};

export default bearerPlugin;
