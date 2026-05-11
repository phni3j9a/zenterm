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
});

const makeClient = () => ({
  listFiles: vi.fn().mockResolvedValue({ path: '~', entries: [] }),
  getFileContent: vi.fn(), writeFileContent: vi.fn(),
  deleteFile: vi.fn(), renameFile: vi.fn(), copyFiles: vi.fn(),
  moveFiles: vi.fn(), createDirectory: vi.fn(),
  buildRawFileUrl: () => '',
  uploadFile: vi.fn().mockResolvedValue({
    success: true, path: '~/up.bin', filename: 'up.bin', size: 4, mimetype: 'application/octet-stream',
  }),
});

describe('Files upload flow', () => {
  beforeEach(() => {
    useFilesStore.getState().reset();
    useUiStore.setState({ toasts: [], confirmDialog: null });
  });

  it('clicking Upload triggers hidden file input → selecting file calls uploadFile', async () => {
    const client = makeClient();
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(client.listFiles).toHaveBeenCalled());

    const input = screen.getByTestId('files-upload-input') as HTMLInputElement;
    const file = new File(['data'], 'up.bin', { type: 'application/octet-stream' });
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => expect(client.uploadFile).toHaveBeenCalledWith(file, '~'));
    await waitFor(() => expect(useUiStore.getState().toasts.some((t) => t.type === 'success')).toBe(true));
    expect(client.listFiles).toHaveBeenCalledTimes(2); // initial + post-upload refresh
  });

  it('drag-drop file fires uploadFile', async () => {
    const client = makeClient();
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(client.listFiles).toHaveBeenCalled());
    fireEvent.dragEnter(window, { dataTransfer: { types: ['Files'] } });
    const overlay = await screen.findByText(/drop files/i);
    const file = new File(['data'], 'dropped.txt', { type: 'text/plain' });
    fireEvent.drop(overlay, { dataTransfer: { files: [file], types: ['Files'] } });
    await waitFor(() => expect(client.uploadFile).toHaveBeenCalledWith(file, '~'));
  });

  it('shows error toast on upload failure', async () => {
    const client = makeClient();
    client.uploadFile = vi.fn().mockRejectedValue(new Error('boom'));
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(client.listFiles).toHaveBeenCalled());

    const input = screen.getByTestId('files-upload-input') as HTMLInputElement;
    const file = new File(['data'], 'up.bin', { type: 'application/octet-stream' });
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => expect(useUiStore.getState().toasts.some((t) => t.type === 'error')).toBe(true));
  });
});
