import type { FastifyPluginAsync } from 'fastify';
import { randomBytes } from 'node:crypto';
import { createWriteStream, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { config } from '../config.js';
import { validatePath } from '../services/filesystem.js';
import type { FileUploadResponse } from '../types/index.js';

const uploadQuerySchema = z.object({
  dest: z.string().optional()
});

function createFailureResponse(mimetype = ''): FileUploadResponse {
  return {
    success: false,
    path: '',
    filename: '',
    size: 0,
    mimetype
  };
}

function generateFilename(originalName: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8).replace(/:/gu, '');
  const rand = randomBytes(4).toString('hex');
  const ext = extname(originalName) || '.bin';
  return `${date}_${time}_${rand}${ext}`;
}

function resolveUploadDir(inputPath: string): string {
  const homeDir = process.env.HOME ?? process.cwd();
  if (inputPath === '~') return homeDir;
  if (inputPath.startsWith('~/')) return resolve(homeDir, inputPath.slice(2));
  return resolve(homeDir, inputPath);
}

function validateUploadDir(uploadDir: string): void {
  let currentPath = uploadDir;

  while (true) {
    try {
      validatePath(currentPath);
      return;
    } catch (error) {
      if ((error as { code?: string }).code !== 'PARENT_NOT_FOUND') throw error;
      const parentPath = dirname(currentPath);
      if (parentPath === currentPath) throw error;
      currentPath = parentPath;
    }
  }
}

function getUploadDir(inputPath?: string): string {
  const uploadDir = resolveUploadDir(inputPath ?? config.UPLOAD_DIR);
  if (!inputPath) return uploadDir;
  validateUploadDir(uploadDir);
  return uploadDir;
}

function removeFile(path: string): void {
  try {
    unlinkSync(path);
  } catch {}
}

function createSuccessResponse(
  destPath: string,
  filename: string,
  mimetype: string
): FileUploadResponse {
  const stats = statSync(destPath);
  return { success: true, path: destPath, filename, size: stats.size, mimetype };
}

const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Reply: FileUploadResponse }>('/api/upload', async (request, reply) => {
    const query = uploadQuerySchema.parse(request.query);
    const uploadDir = getUploadDir(query.dest);
    const data = await request.file({ throwFileSizeLimit: false });
    if (!data) return reply.status(400).send(createFailureResponse());
    mkdirSync(uploadDir, { recursive: true });

    const filename = generateFilename(data.filename);
    const destPath = join(uploadDir, filename);
    await pipeline(data.file, createWriteStream(destPath));

    if (data.file.truncated) {
      removeFile(destPath);
      return reply.status(413).send(createFailureResponse(data.mimetype));
    }

    return createSuccessResponse(destPath, filename, data.mimetype);
  });
};

export default uploadRoutes;
