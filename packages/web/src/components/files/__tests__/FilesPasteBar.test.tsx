import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useFilesStore } from '@/stores/files';
import { FilesPasteBar } from '../FilesPasteBar';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

describe('FilesPasteBar', () => {
  beforeEach(() => useFilesStore.getState().reset());

  it('renders nothing when clipboard empty', () => {
    const { container } = render(<FilesPasteBar onPaste={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows clipboard count + paste button when clipboard set', () => {
    useFilesStore.setState({ clipboard: { items: ['~/a', '~/b'], mode: 'copy' } });
    render(<FilesPasteBar onPaste={vi.fn()} />);
    expect(screen.getByText(/2 item/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /paste/i })).toBeInTheDocument();
  });

  it('clicking paste fires onPaste with clipboard', () => {
    useFilesStore.setState({ clipboard: { items: ['~/a'], mode: 'cut' } });
    const onPaste = vi.fn();
    render(<FilesPasteBar onPaste={onPaste} />);
    fireEvent.click(screen.getByRole('button', { name: /paste/i }));
    expect(onPaste).toHaveBeenCalledWith({ items: ['~/a'], mode: 'cut' });
  });
});
