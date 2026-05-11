import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useFilesStore } from '@/stores/files';
import { FilesBulkActionBar } from '../FilesBulkActionBar';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

describe('FilesBulkActionBar', () => {
  beforeEach(() => useFilesStore.getState().reset());

  it('renders nothing when not in selection mode or empty selection', () => {
    const { container } = render(<FilesBulkActionBar onCopy={vi.fn()} onCut={vi.fn()} onDelete={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows copy/cut/delete buttons when items selected', () => {
    useFilesStore.setState({ selectionMode: true, selectedNames: new Set(['a']) });
    render(<FilesBulkActionBar onCopy={vi.fn()} onCut={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cut/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('clicking copy fires onCopy with selected names', () => {
    useFilesStore.setState({ selectionMode: true, selectedNames: new Set(['a', 'b']) });
    const onCopy = vi.fn();
    render(<FilesBulkActionBar onCopy={onCopy} onCut={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    // Set order may vary; assert the args contain both
    expect(onCopy).toHaveBeenCalledTimes(1);
    const args = onCopy.mock.calls[0][0] as string[];
    expect([...args].sort()).toEqual(['a', 'b']);
  });
});
