import type { FastifyPluginAsync } from 'fastify';
import { readClaudeLimits } from '../services/claudeStatus.js';

const claudeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/claude/limits', async () => readClaudeLimits());
};

export default claudeRoutes;
