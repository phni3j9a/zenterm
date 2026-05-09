process.env.AUTH_TOKEN = 'test-token';
process.env.LOG_LEVEL = 'error';

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

async function buildTestApp(): Promise<FastifyInstance> {
  const { buildApp } = await import('../../app.js');
  const app = await buildApp();
  await app.ready();
  return app;
}

describe('GET /web routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /web returns the SPA index.html', async () => {
    const res = await app.inject({ method: 'GET', url: '/web' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('<div id="root">');
  });

  it('GET /web/sessions also returns index.html (SPA fallback)', async () => {
    const res = await app.inject({ method: 'GET', url: '/web/sessions' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('<div id="root">');
  });

  it('GET /web/sessions/foo/window/0 also returns index.html (SPA fallback)', async () => {
    const res = await app.inject({ method: 'GET', url: '/web/sessions/foo/window/0' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<div id="root">');
  });
});
