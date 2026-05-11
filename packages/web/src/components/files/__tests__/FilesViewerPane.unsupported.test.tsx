import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { FilesViewerPane } from '../FilesViewerPane';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

describe('FilesViewerPane unsupported kind', () => {
  beforeEach(() => useFilesPreviewStore.getState().clear());

  it('renders header (with Download button) even for unsupported kind', () => {
    useFilesPreviewStore.getState().selectFile('~/a.zip', 'a.zip', 'unsupported');
    const client = {
      listFiles: vi.fn(), writeFileContent: vi.fn(), deleteFile: vi.fn(),
      renameFile: vi.fn(), copyFiles: vi.fn(), moveFiles: vi.fn(),
      createDirectory: vi.fn(), uploadFile: vi.fn(),
      buildRawFileUrl: () => '', getFileContent: vi.fn(),
    };
    render(<FilesViewerPane client={client as any} token="tok" />);
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
    expect(screen.getByText(/cannot open/i)).toBeInTheDocument();
  });
});
