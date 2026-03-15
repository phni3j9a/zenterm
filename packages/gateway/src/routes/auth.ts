import type { FastifyPluginAsync } from 'fastify';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/auth/verify', async () => ({ ok: true }));
};

export default authRoutes;
