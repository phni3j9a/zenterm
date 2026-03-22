import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { listDirectory, readFileContent, readFileRaw, writeFileContent } from '../services/filesystem.js';

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

  fastify.get('/api/files/raw', async (request, reply) => {
    const query = contentQuerySchema.parse(request.query);
    const info = readFileRaw(query.path);

    void reply
      .header('Content-Type', info.mimeType)
      .header('Content-Length', info.size)
      .header('Content-Disposition', `inline; filename="${encodeURIComponent(info.filename)}"`)
      .header('Cache-Control', 'private, max-age=300');

    return reply.send(info.stream);
  });
};

export default fileRoutes;
