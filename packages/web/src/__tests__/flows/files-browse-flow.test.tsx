import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { Sidebar } from '@/components/Sidebar';
import { useFilesStore } from '@/stores/files';

beforeEach(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
  useFilesStore.getState().reset();
});

describe('Files browse flow', () => {
  it('mount → initial load → click directory → list updates', async () => {
    const listFiles = vi.fn()
      .mockResolvedValueOnce({
        path: '~',
        entries: [
          { name: 'sub', type: 'directory', size: 0, modified: 0, permissions: 'rwxr-xr-x' },
        ],
      })
      .mockResolvedValueOnce({
        path: '~/sub',
        entries: [
          { name: 'inner.ts', type: 'file', size: 10, modified: 0, permissions: 'rw-r--r--' },
        ],
      });
    const filesClient = {
      listFiles,
      getFileContent: vi.fn(), writeFileContent: vi.fn(), deleteFile: vi.fn(),
      renameFile: vi.fn(), copyFiles: vi.fn(), moveFiles: vi.fn(),
      createDirectory: vi.fn(), uploadFile: vi.fn(), buildRawFileUrl: vi.fn(),
    };

    render(
      <MemoryRouter initialEntries={['/web/files']}>
        <Sidebar
          sessions={[]} loading={false} error={null}
          activeSessionId={null} activeWindowIndex={null}
          onSelect={vi.fn()} onCreateSession={vi.fn()} onRenameSession={vi.fn()}
          onRequestDeleteSession={vi.fn()} onCreateWindow={vi.fn()} onRenameWindow={vi.fn()}
          onRequestDeleteWindow={vi.fn()}
          filesClient={filesClient as any}
        />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: /sub/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /sub/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /inner\.ts/ })).toBeInTheDocument());

    expect(listFiles).toHaveBeenCalledTimes(2);
    expect(listFiles.mock.calls[0]).toEqual(['~', false]);
    expect(listFiles.mock.calls[1]).toEqual(['~/sub', false]);
  });
});
