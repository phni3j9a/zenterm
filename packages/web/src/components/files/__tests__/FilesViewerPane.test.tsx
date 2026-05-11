import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { FilesViewerPane } from '../FilesViewerPane';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

const makeClient = () => ({
  listFiles: vi.fn(), writeFileContent: vi.fn(), deleteFile: vi.fn(),
  renameFile: vi.fn(), copyFiles: vi.fn(), moveFiles: vi.fn(),
  createDirectory: vi.fn(), uploadFile: vi.fn(),
  buildRawFileUrl: (p: string) => `http://gw/api/files/raw?path=${encodeURIComponent(p)}`,
  getFileContent: vi.fn().mockResolvedValue({ path: '~/a.ts', content: 'hello world', lines: 1, truncated: false }),
});

describe('FilesViewerPane', () => {
  beforeEach(() => useFilesPreviewStore.getState().clear());

  it('shows empty state when nothing selected', () => {
    render(<FilesViewerPane client={makeClient() as any} token="tok" />);
    expect(screen.getByText(/no file selected/i)).toBeInTheDocument();
  });

  it('fetches and shows text content for text file', async () => {
    const client = makeClient();
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    render(<FilesViewerPane client={client as any} token="tok" />);
    await waitFor(() => expect(client.getFileContent).toHaveBeenCalledWith('~/a.ts'));
    await waitFor(() => expect(screen.getByText('hello world')).toBeInTheDocument());
  });

  it('renders unsupported empty state for unsupported kind', () => {
    useFilesPreviewStore.getState().selectFile('~/a.zip', 'a.zip', 'unsupported');
    render(<FilesViewerPane client={makeClient() as any} token="tok" />);
    expect(screen.getByText(/cannot open/i)).toBeInTheDocument();
  });
});
