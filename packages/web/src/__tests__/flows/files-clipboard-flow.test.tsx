import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useFilesStore } from '@/stores/files';
import { useUiStore } from '@/stores/ui';
import { FilesSidebarPanel } from '@/components/files/FilesSidebarPanel';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };
  }
});

const makeClient = () => ({
  listFiles: vi.fn().mockResolvedValue({
    path: '~',
    entries: [
      { name: 'src', type: 'directory', size: 0, modified: 0, permissions: 'rwxr-xr-x' },
      { name: 'a.ts', type: 'file', size: 0, modified: 0, permissions: 'rw-r--r--' },
      { name: 'b.ts', type: 'file', size: 0, modified: 0, permissions: 'rw-r--r--' },
    ],
  }),
  getFileContent: vi.fn(), writeFileContent: vi.fn(),
  deleteFile: vi.fn(), renameFile: vi.fn(),
  createDirectory: vi.fn(), uploadFile: vi.fn(),
  buildRawFileUrl: () => '',
  copyFiles: vi.fn().mockResolvedValue({ copied: [] }),
  moveFiles: vi.fn().mockResolvedValue({ moved: [] }),
});

describe('Files clipboard flow', () => {
  beforeEach(() => {
    useFilesStore.getState().reset();
    useUiStore.setState({ toasts: [], confirmDialog: null });
  });

  it('Ctrl+Click enters selection mode and selects entry', async () => {
    const client = makeClient();
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /a\.ts/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /a\.ts/ }), { ctrlKey: true });
    expect(useFilesStore.getState().selectionMode).toBe(true);
    expect(useFilesStore.getState().selectedNames.has('a.ts')).toBe(true);
  });

  it('copy → store clipboard with copy mode → toast', async () => {
    const client = makeClient();
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /a\.ts/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /a\.ts/ }), { ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: /b\.ts/ }));
    expect(useFilesStore.getState().selectedNames.size).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: /^copy$/i }));
    expect(useFilesStore.getState().clipboard?.mode).toBe('copy');
    // Set order may vary
    expect([...(useFilesStore.getState().clipboard?.items ?? [])].sort()).toEqual(['~/a.ts', '~/b.ts']);
    expect(useUiStore.getState().toasts.some((t) => t.message.includes('clipboard') || t.message.includes('クリップボード'))).toBe(true);
  });

  it('paste in copy mode calls copyFiles', async () => {
    const client = makeClient();
    useFilesStore.setState({ clipboard: { items: ['~/a.ts'], mode: 'copy' } });
    useFilesStore.setState({ currentPath: '~' });
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /^paste$/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^paste$/i }));
    await waitFor(() => expect(client.copyFiles).toHaveBeenCalledWith(['~/a.ts'], '~'));
  });

  it('paste in cut mode calls moveFiles and clears clipboard', async () => {
    const client = makeClient();
    useFilesStore.setState({ clipboard: { items: ['~/a.ts'], mode: 'cut' }, currentPath: '~/sub' });
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /^paste$/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^paste$/i }));
    await waitFor(() => expect(client.moveFiles).toHaveBeenCalledWith(['~/a.ts'], '~/sub'));
    expect(useFilesStore.getState().clipboard).toBeNull();
  });

  it('bulk delete calls deleteFile for each selected item', async () => {
    const client = makeClient();
    client.deleteFile = vi.fn().mockResolvedValue({ path: '', deleted: true });
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /a\.ts/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /a\.ts/ }), { ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: /b\.ts/ }));

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(useUiStore.getState().confirmDialog).not.toBeNull();
    await useUiStore.getState().confirmDialog!.onConfirm();

    expect(client.deleteFile).toHaveBeenCalledTimes(2);
  });
});
