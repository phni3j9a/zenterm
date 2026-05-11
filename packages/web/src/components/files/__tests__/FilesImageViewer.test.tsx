import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { FilesImageViewer } from '../FilesImageViewer';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

describe('FilesImageViewer', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob(['x'])));
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:img' });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} });
  });
  afterEach(() => fetchSpy.mockRestore());

  it('renders <img> with Blob URL once fetched', async () => {
    render(<FilesImageViewer rawUrl="http://gw/api/files/raw?path=x" token="tok" name="x.png" />);
    await waitFor(() => expect(screen.getByRole('img', { name: 'x.png' })).toHaveAttribute('src', 'blob:img'));
  });

  it('renders nothing when rawUrl=null', () => {
    const { container } = render(<FilesImageViewer rawUrl={null} token="tok" name="x.png" />);
    expect(container.querySelector('img')).toBeNull();
  });
});
