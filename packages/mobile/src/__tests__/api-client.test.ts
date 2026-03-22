import {
  ApiError,
  getFileContent,
  getFileRawUrl,
  getSystemStatus,
  listFiles,
  uploadFile,
  uploadFileToPath,
  writeFileContent,
} from '../api/client';
import type { Server } from '../types';

const mockServer: Server = {
  id: 'test-1',
  name: 'Test Server',
  url: 'http://localhost:3000',
  token: 'test-token',
  isDefault: true,
};

class MockFormData {
  public entries: Array<[string, unknown]> = [];

  append(name: string, value: unknown): void {
    this.entries.push([name, value]);
  }
}

const originalFormData = global.FormData;

describe('API client', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.FormData = originalFormData;
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
        'http://localhost:3000/api/files?path=%2Fhome%2Fuser&showHidden=true',
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
        'http://localhost:3000/api/files?path=~&showHidden=true',
        expect.anything(),
      );
    });

    it('allows disabling hidden files', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ path: '/home/user', entries: [] }),
      });

      await listFiles(mockServer, '/home/user', false);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/files?path=%2Fhome%2Fuser&showHidden=false',
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

  describe('getFileRawUrl', () => {
    it('builds the raw file URL with an encoded path', () => {
      const url = getFileRawUrl(
        { ...mockServer, url: 'http://localhost:3000/' },
        '/home/user/My File.png',
      );

      expect(url).toBe('http://localhost:3000/api/files/raw?path=%2Fhome%2Fuser%2FMy%20File.png');
    });
  });

  describe('writeFileContent', () => {
    it('writes file content with JSON payload', async () => {
      const mockResponse = { path: '/home/user/test.txt', bytes: 5 };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await writeFileContent(mockServer, '/home/user/test.txt', 'hello');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/files/content',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ path: '/home/user/test.txt', content: 'hello' }),
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('uploadFile', () => {
    it('uploads file with FormData and auth header only', async () => {
      const formData = new MockFormData();
      const formDataCtor = jest.fn(() => formData as unknown as FormData);
      const mockResponse = {
        success: true,
        path: '/uploads/test.png',
        filename: 'test.png',
        size: 123,
        mimetype: 'image/png',
      };

      global.FormData = formDataCtor as unknown as typeof FormData;
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await uploadFile(mockServer, 'file:///tmp/test.png', 'test.png', 'image/png');
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];

      expect(formDataCtor).toHaveBeenCalledTimes(1);
      expect(formData.entries).toEqual([
        ['image', { uri: 'file:///tmp/test.png', name: 'test.png', type: 'image/png' }],
      ]);
      expect(url).toBe('http://localhost:3000/api/upload');
      expect(options).toMatchObject({
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
      });
      expect(options.body).toBe(formData);
      expect(result).toEqual(mockResponse);
    });

    it('throws ApiError when upload fails', async () => {
      global.FormData = jest.fn(() => new MockFormData() as unknown as FormData) as unknown as typeof FormData;
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ message: 'invalid file' }),
      });

      const promise = uploadFile(mockServer, 'file:///tmp/test.png', 'test.png', 'image/png');

      await expect(promise).rejects.toBeInstanceOf(ApiError);
      await expect(promise).rejects.toMatchObject({
        status: 400,
        message: 'invalid file',
      });
    });
  });

  describe('uploadFileToPath', () => {
    it('uploads file to the requested destination with FormData and auth header', async () => {
      const formData = new MockFormData();
      const formDataCtor = jest.fn(() => formData as unknown as FormData);
      const mockResponse = {
        success: true,
        path: '/home/user/uploads/test.pdf',
        filename: 'test.pdf',
        size: 456,
        mimetype: 'application/pdf',
      };

      global.FormData = formDataCtor as unknown as typeof FormData;
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await uploadFileToPath(
        mockServer,
        'file:///tmp/test.pdf',
        'test.pdf',
        'application/pdf',
        '/home/user/uploads',
      );
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];

      expect(formDataCtor).toHaveBeenCalledTimes(1);
      expect(formData.entries).toEqual([
        ['file', { uri: 'file:///tmp/test.pdf', name: 'test.pdf', type: 'application/pdf' }],
      ]);
      expect(url).toBe('http://localhost:3000/api/upload?dest=%2Fhome%2Fuser%2Fuploads');
      expect(options).toMatchObject({
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
      });
      expect(options.body).toBe(formData);
      expect(result).toEqual(mockResponse);
    });

    it('throws ApiError when destination upload fails', async () => {
      global.FormData = jest.fn(() => new MockFormData() as unknown as FormData) as unknown as typeof FormData;
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: () => Promise.resolve({ message: 'upload failed' }),
      });

      const promise = uploadFileToPath(
        mockServer,
        'file:///tmp/test.pdf',
        'test.pdf',
        'application/pdf',
        '/home/user/uploads',
      );

      await expect(promise).rejects.toBeInstanceOf(ApiError);
      await expect(promise).rejects.toMatchObject({
        status: 500,
        message: 'upload failed',
      });
    });
  });
});
