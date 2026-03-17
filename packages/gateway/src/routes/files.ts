import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { listDirectory, readFileContent } from '../services/filesystem.js';

const listQuerySchema = z.object({
  path: z.string().min(1).default('~')
});

const contentQuerySchema = z.object({
  path: z.string().min(1)
});

const fileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/files', async (request) => {
    const query = listQuerySchema.parse(request.query);
    return listDirectory(query.path);
  });

  fastify.get('/api/files/content', async (request) => {
    const query = contentQuerySchema.parse(request.query);
    return readFileContent(query.path);
  });
};

export default fileRoutes;
