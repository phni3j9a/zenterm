import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { listDirectory, readFileContent, writeFileContent } from '../services/filesystem.js';

const listQuerySchema = z.object({
  path: z.string().min(1).default('~'),
  showHidden: z.enum(['true', 'false']).default('true')
});

const contentQuerySchema = z.object({
  path: z.string().min(1)
});

const writeBodySchema = z.object({
  path: z.string().min(1),
  content: z.string()
});

const fileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/files', async (request) => {
    const query = listQuerySchema.parse(request.query);
    return listDirectory(query.path, query.showHidden === 'true');
  });

  fastify.get('/api/files/content', async (request) => {
    const query = contentQuerySchema.parse(request.query);
    return readFileContent(query.path);
  });

  fastify.put('/api/files/content', async (request) => {
    const body = writeBodySchema.parse(request.body);
    return writeFileContent(body.path, body.content);
  });
};

export default fileRoutes;
