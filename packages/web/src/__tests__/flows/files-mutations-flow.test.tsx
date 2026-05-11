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

const baseEntries = [
  { name: 'src', type: 'directory', size: 0, modified: 0, permissions: 'rwxr-xr-x' },
  { name: 'a.ts', type: 'file', size: 0, modified: 0, permissions: 'rw-r--r--' },
];

const makeClient = () => ({
  listFiles: vi.fn().mockResolvedValue({ path: '~', entries: baseEntries }),
  getFileContent: vi.fn(), writeFileContent: vi.fn(), uploadFile: vi.fn(),
  copyFiles: vi.fn(), moveFiles: vi.fn(), buildRawFileUrl: () => '',
  deleteFile: vi.fn().mockResolvedValue({ path: '~/a.ts', deleted: true }),
  renameFile: vi.fn().mockResolvedValue({ oldPath: '~/a.ts', newPath: '~/b.ts' }),
  createDirectory: vi.fn().mockResolvedValue({ path: '~/newdir', created: true }),
});

describe('Files mutations flow', () => {
  beforeEach(() => {
    useFilesStore.getState().reset();
    useUiStore.setState({ toasts: [], confirmDialog: null });
  });

  it('mkdir from toolbar New menu', async () => {
    const client = makeClient();
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /a\.ts/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^new/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /new folder/i }));

    const input = await screen.findByPlaceholderText(/folder name/i);
    fireEvent.change(input, { target: { value: 'newdir' } });
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));

    await waitFor(() => expect(client.createDirectory).toHaveBeenCalledWith('~/newdir'));
    await waitFor(() => expect(useUiStore.getState().toasts.some((t) => t.type === 'success')).toBe(true));
    expect(client.listFiles).toHaveBeenCalledTimes(2); // initial + after mkdir
  });

  it('delete via context menu shows confirm and calls deleteFile on confirm', async () => {
    const client = makeClient();
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /a\.ts/ })).toBeInTheDocument());

    fireEvent.contextMenu(screen.getByRole('button', { name: /a\.ts/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /delete/i }));

    expect(useUiStore.getState().confirmDialog).not.toBeNull();
    await useUiStore.getState().confirmDialog!.onConfirm();
    expect(client.deleteFile).toHaveBeenCalledWith('~/a.ts');
  });

  it('rename via context menu opens dialog and calls renameFile', async () => {
    const client = makeClient();
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /a\.ts/ })).toBeInTheDocument());

    fireEvent.contextMenu(screen.getByRole('button', { name: /a\.ts/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /rename/i }));

    const input = await screen.findByDisplayValue('a.ts');
    fireEvent.change(input, { target: { value: 'b.ts' } });
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));

    await waitFor(() => expect(client.renameFile).toHaveBeenCalledWith('~/a.ts', 'b.ts'));
  });

  it('clears preview when the deleted file is currently selected', async () => {
    const client = makeClient();
    const { useFilesPreviewStore } = await import('@/stores/filesPreview');
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');

    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /a\.ts/ })).toBeInTheDocument());

    fireEvent.contextMenu(screen.getByRole('button', { name: /a\.ts/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /delete/i }));
    await useUiStore.getState().confirmDialog!.onConfirm();

    expect(useFilesPreviewStore.getState().selectedPath).toBeNull();
  });

  it('updates preview store path when active file is renamed', async () => {
    const client = makeClient();
    const { useFilesPreviewStore } = await import('@/stores/filesPreview');
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');

    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /a\.ts/ })).toBeInTheDocument());

    fireEvent.contextMenu(screen.getByRole('button', { name: /a\.ts/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /rename/i }));

    const input = await screen.findByDisplayValue('a.ts');
    fireEvent.change(input, { target: { value: 'b.ts' } });
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));

    await waitFor(() => expect(useFilesPreviewStore.getState().selectedName).toBe('b.ts'));
    expect(useFilesPreviewStore.getState().selectedPath).toBe('~/b.ts');
  });
});
