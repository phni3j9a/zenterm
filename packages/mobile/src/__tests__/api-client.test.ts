import { getSystemStatus, listFiles, getFileContent, apiRequest } from '../api/client';
import type { Server } from '../types';

const mockServer: Server = {
  id: 'test-1',
  name: 'Test Server',
  url: 'http://localhost:3000',
  token: 'test-token',
  isDefault: true,
};

describe('API client', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getSystemStatus', () => {
    it('calls /api/system/status with correct auth header', async () => {
      const mockStatus = {
        cpu: { usage: 25, cores: 4, model: 'ARM', loadAvg: [0.5] },
        memory: { total: 8e9, used: 4e9, free: 4e9, percent: 50 },
        disk: { total: 200e9, used: 100e9, free: 100e9, percent: 50 },
        temperature: 45,
        uptime: 3600,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      });

      const result = await getSystemStatus(mockServer);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/system/status',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );
      expect(result).toEqual(mockStatus);
    });
  });

  describe('listFiles', () => {
    it('calls /api/files with encoded path parameter', async () => {
      const mockResponse = {
        path: '/home/user',
        entries: [{ name: 'test.txt', type: 'file', size: 100, modified: 1000, permissions: '-rw-r--r--' }],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await listFiles(mockServer, '/home/user');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/files?path=%2Fhome%2Fuser',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('defaults to ~ when no path is provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ path: '~', entries: [] }),
      });

      await listFiles(mockServer);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/files?path=~',
        expect.anything(),
      );
    });
  });

  describe('getFileContent', () => {
    it('calls /api/files/content with encoded path parameter', async () => {
      const mockResponse = {
        path: '/home/user/test.txt',
        content: 'hello',
        lines: 1,
        truncated: false,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getFileContent(mockServer, '/home/user/test.txt');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/files/content?path=%2Fhome%2Fuser%2Ftest.txt',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });
  });
});
