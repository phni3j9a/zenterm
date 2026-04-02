import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { copyItems, createDirectory, deleteItem, listDirectory, moveItems, readFileContent, readFileRaw, renameItem, writeFileContent } from '../services/filesystem.js';

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

const deleteBodySchema = z.object({
  path: z.string().min(1)
});

const renameBodySchema = z.object({
  path: z.string().min(1),
  newName: z.string().min(1).max(255)
});

const copyMoveBodySchema = z.object({
  sources: z.array(z.string().min(1)).min(1),
  destination: z.string().min(1)
});

const mkdirBodySchema = z.object({
  path: z.string().min(1)
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

  fastify.delete('/api/files', async (request) => {
    const body = deleteBodySchema.parse(request.body);
    return deleteItem(body.path);
  });

  fastify.post('/api/files/rename', async (request) => {
    const body = renameBodySchema.parse(request.body);
    return renameItem(body.path, body.newName);
  });

  fastify.post('/api/files/copy', async (request) => {
    const body = copyMoveBodySchema.parse(request.body);
    return copyItems(body.sources, body.destination);
  });

  fastify.post('/api/files/move', async (request) => {
    const body = copyMoveBodySchema.parse(request.body);
    return moveItems(body.sources, body.destination);
  });

  fastify.post('/api/files/mkdir', async (request) => {
    const body = mkdirBodySchema.parse(request.body);
    return createDirectory(body.path);
  });
};

export default fileRoutes;
