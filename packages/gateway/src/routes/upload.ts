import type { FastifyPluginAsync } from 'fastify';
import { randomBytes } from 'node:crypto';
import { createWriteStream, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { config } from '../config.js';
import type { FileUploadResponse } from '../types/index.js';

const ALLOWED_MIMETYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp'
]);

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
  if (inputPath === '~') {
    return homeDir;
  }

  if (inputPath.startsWith('~/')) {
    return resolve(homeDir, inputPath.slice(2));
  }

  return inputPath;
}

function removeFile(path: string): void {
  try {
    unlinkSync(path);
  } catch {}
}

const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Reply: FileUploadResponse }>('/api/upload', async (request, reply) => {
    const data = await request.file({ throwFileSizeLimit: false });
    if (!data) {
      return reply.status(400).send(createFailureResponse());
    }

    if (!ALLOWED_MIMETYPES.has(data.mimetype)) {
      data.file.resume();
      return reply.status(400).send(createFailureResponse(data.mimetype));
    }

    const uploadDir = resolveUploadDir(config.UPLOAD_DIR);
    mkdirSync(uploadDir, { recursive: true });

    const filename = generateFilename(data.filename);
    const destPath = join(uploadDir, filename);
    await pipeline(data.file, createWriteStream(destPath));

    if (data.file.truncated) {
      removeFile(destPath);
      return reply.status(413).send(createFailureResponse(data.mimetype));
    }

    const stats = statSync(destPath);
    return {
      success: true,
      path: destPath,
      filename,
      size: stats.size,
      mimetype: data.mimetype
    };
  });
};

export default uploadRoutes;
