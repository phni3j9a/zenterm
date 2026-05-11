import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../client';

describe('ApiClient files methods', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const makeRes = (body: unknown, contentType = 'application/json'): Response =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': contentType },
    });

  it('listFiles GET /api/files with path & showHidden', async () => {
    fetchSpy.mockResolvedValue(makeRes({ path: '~', entries: [] }));
    const c = new ApiClient('http://gw', 'tok');
    await c.listFiles('~', true);
    expect(fetchSpy).toHaveBeenCalledWith(
      `http://gw/api/files?path=${encodeURIComponent('~')}&showHidden=true`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('getFileContent GET /api/files/content?path=', async () => {
    fetchSpy.mockResolvedValue(makeRes({ path: '~/a.txt', content: 'hi', lines: 1, truncated: false }));
    const c = new ApiClient('http://gw', 'tok');
    const r = await c.getFileContent('~/a.txt');
    expect(r.content).toBe('hi');
    expect(fetchSpy.mock.calls[0][0]).toContain('/api/files/content?path=');
  });

  it('writeFileContent PUT /api/files/content with body', async () => {
    fetchSpy.mockResolvedValue(makeRes({ path: '~/a.txt', bytes: 2 }));
    const c = new ApiClient('http://gw', 'tok');
    await c.writeFileContent('~/a.txt', 'hi');
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({ path: '~/a.txt', content: 'hi' }),
    });
  });

  it('deleteFile DELETE /api/files with body', async () => {
    fetchSpy.mockResolvedValue(makeRes({ path: '~/a.txt', deleted: true }));
    const c = new ApiClient('http://gw', 'tok');
    await c.deleteFile('~/a.txt');
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({
      method: 'DELETE',
      body: JSON.stringify({ path: '~/a.txt' }),
    });
  });

  it('renameFile POST /api/files/rename', async () => {
    fetchSpy.mockResolvedValue(makeRes({ oldPath: '~/a', newPath: '~/b' }));
    const c = new ApiClient('http://gw', 'tok');
    await c.renameFile('~/a', 'b');
    expect(fetchSpy.mock.calls[0][0]).toBe('http://gw/api/files/rename');
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ path: '~/a', newName: 'b' }),
    });
  });

  it('copyFiles POST /api/files/copy', async () => {
    fetchSpy.mockResolvedValue(makeRes({ copied: [] }));
    const c = new ApiClient('http://gw', 'tok');
    await c.copyFiles(['~/a'], '~/dst');
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ sources: ['~/a'], destination: '~/dst' }),
    });
  });

  it('moveFiles POST /api/files/move', async () => {
    fetchSpy.mockResolvedValue(makeRes({ moved: [] }));
    const c = new ApiClient('http://gw', 'tok');
    await c.moveFiles(['~/a'], '~/dst');
    expect(fetchSpy.mock.calls[0][0]).toBe('http://gw/api/files/move');
  });

  it('createDirectory POST /api/files/mkdir', async () => {
    fetchSpy.mockResolvedValue(makeRes({ path: '~/d', created: true }));
    const c = new ApiClient('http://gw', 'tok');
    await c.createDirectory('~/d');
    expect(fetchSpy.mock.calls[0][0]).toBe('http://gw/api/files/mkdir');
  });

  it('buildRawFileUrl returns base + /api/files/raw?path=', () => {
    const c = new ApiClient('http://gw', 'tok');
    expect(c.buildRawFileUrl('~/a.png')).toBe(`http://gw/api/files/raw?path=${encodeURIComponent('~/a.png')}`);
  });

  it('uploadFile POST /api/upload?dest=&preserveName=true with FormData', async () => {
    fetchSpy.mockResolvedValue(makeRes({
      success: true, path: '~/a.bin', filename: 'a.bin', size: 4, mimetype: 'application/octet-stream',
    }));
    const c = new ApiClient('http://gw', 'tok');
    const blob = new Blob(['1234'], { type: 'application/octet-stream' });
    const f = new File([blob], 'a.bin', { type: 'application/octet-stream' });
    await c.uploadFile(f, '~');
    expect(fetchSpy.mock.calls[0][0]).toContain(`/api/upload?dest=${encodeURIComponent('~')}&preserveName=true`);
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
  });
});
