import type { FastifyPluginAsync } from 'fastify';
import { getSystemStatus } from '../services/system.js';

const systemRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/system/status', async () => getSystemStatus());
};

export default systemRoutes;
