import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { FilePaneViewer } from '../FilePaneViewer';
import type { FilesApiClient } from '../filesApi';

beforeAll(() => {
  useSettingsStore.setState({ language: 'ja' });
  initI18n();
});

function makeClient(overrides: Partial<FilesApiClient> = {}): FilesApiClient {
  return {
    listFiles: vi.fn(),
    getFileContent: vi.fn(async () => ({ path: '/tmp/a.txt', content: 'hello', lines: 1, truncated: false })),
    writeFileContent: vi.fn(async () => ({ path: '/tmp/a.txt', bytes: 5 })),
    deleteFile: vi.fn(),
    renameFile: vi.fn(),
    copyFiles: vi.fn(),
    moveFiles: vi.fn(),
    createDirectory: vi.fn(),
    uploadFile: vi.fn(),
    buildRawFileUrl: (p: string) => `/raw${p}`,
    ...overrides,
  } as FilesApiClient;
}

describe('FilePaneViewer', () => {
  it('テキストファイルを取得して表示する', async () => {
    const client = makeClient();
    render(<FilePaneViewer path="/tmp/a.txt" client={client} token="t" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/hello/)).toBeInTheDocument());
  });

  it('× ボタンで onClose を呼ぶ', async () => {
    const onClose = vi.fn();
    render(<FilePaneViewer path="/tmp/a.txt" client={makeClient()} token="t" onClose={onClose} />);
    await waitFor(() => screen.getByText(/hello/));
    await userEvent.click(screen.getByRole('button', { name: /閉じる|close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('API 取得エラー時にペイン内エラー表示を出すが close は呼ばない', async () => {
    const onClose = vi.fn();
    const client = makeClient({
      getFileContent: vi.fn(async () => { throw new Error('boom'); }),
    });
    render(<FilePaneViewer path="/tmp/a.txt" client={client} token="t" onClose={onClose} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('path が変わると再取得する', async () => {
    const get = vi.fn(async (p: string) => ({ path: p, content: p, lines: 1, truncated: false }));
    const client = makeClient({ getFileContent: get });
    const { rerender } = render(
      <FilePaneViewer path="/a" client={client} token="t" onClose={() => {}} />
    );
    await waitFor(() => screen.getByText('/a'));
    rerender(<FilePaneViewer path="/b" client={client} token="t" onClose={() => {}} />);
    await waitFor(() => screen.getByText('/b'));
    expect(get).toHaveBeenCalledTimes(2);
  });
});
