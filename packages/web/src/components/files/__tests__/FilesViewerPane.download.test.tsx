import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { FilesViewerPane } from '../FilesViewerPane';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

describe('FilesViewerPane download', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    useFilesPreviewStore.getState().clear();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob(['payload'])));
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:dl' });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} });
  });
  afterEach(() => fetchSpy.mockRestore());

  it('clicking Download fetches raw URL with Bearer and triggers download', async () => {
    useFilesPreviewStore.getState().selectFile('~/a.bin', 'a.bin', 'unsupported');
    const client = {
      listFiles: vi.fn(), writeFileContent: vi.fn(), deleteFile: vi.fn(),
      renameFile: vi.fn(), copyFiles: vi.fn(), moveFiles: vi.fn(),
      createDirectory: vi.fn(), uploadFile: vi.fn(),
      buildRawFileUrl: (p: string) => `http://gw/api/files/raw?path=${encodeURIComponent(p)}`,
      getFileContent: vi.fn(),
    };
    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        (el as HTMLAnchorElement).click = clickSpy;
      }
      return el;
    });

    render(<FilesViewerPane client={client as any} token="tok" />);
    fireEvent.click(screen.getByRole('button', { name: /download/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
  });
});
