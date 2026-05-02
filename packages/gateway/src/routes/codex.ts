import type { FastifyPluginAsync } from 'fastify';
import { readCodexLimits } from '../services/codexStatus.js';

const codexRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/codex/limits', async () => readCodexLimits());
};

export default codexRoutes;
