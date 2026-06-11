import type { FastifyPluginAsync } from 'fastify';
import { getSystemStatus } from '../services/system.js';
import { getNetworkAddresses } from '../services/network.js';
import { config } from '../config.js';

const systemRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/system/status', async () => getSystemStatus());
  fastify.get('/api/system/network', async () => ({
    ...getNetworkAddresses(),
    port: config.PORT,
  }));
};

export default systemRoutes;
