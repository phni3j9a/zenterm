import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loadDirectory } from '../filesApi';
import { useFilesStore } from '@/stores/files';

describe('loadDirectory', () => {
  beforeEach(() => useFilesStore.getState().reset());

  it('sets loading=true, calls listFiles, populates entries on success', async () => {
    const listFiles = vi.fn().mockResolvedValue({
      path: '~',
      entries: [{ name: 'a', type: 'file', size: 0, modified: 0, permissions: '' }],
    });
    await loadDirectory({ listFiles } as any, '~', false);
    const s = useFilesStore.getState();
    expect(listFiles).toHaveBeenCalledWith('~', false);
    expect(s.entries).toHaveLength(1);
    expect(s.currentPath).toBe('~');
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('sets error on failure', async () => {
    const listFiles = vi.fn().mockRejectedValue(new Error('boom'));
    await loadDirectory({ listFiles } as any, '~', false);
    const s = useFilesStore.getState();
    expect(s.error).toContain('boom');
    expect(s.loading).toBe(false);
  });
});
