import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import type { FileEntry } from '@zenterm/shared';
import { FilesDetailsDialog } from '../FilesDetailsDialog';

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

const entry: FileEntry = {
  name: 'a.ts', type: 'file', size: 1024, modified: 1704153600, permissions: 'rw-r--r--',
};

describe('FilesDetailsDialog', () => {
  it('renders size, modified, permissions', () => {
    render(<FilesDetailsDialog open entry={entry} locale="en-US" onClose={vi.fn()} />);
    expect(screen.getByText(/1\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/rw-r--r--/)).toBeInTheDocument();
  });

  it('clicking close fires onClose', () => {
    const onClose = vi.fn();
    render(<FilesDetailsDialog open entry={entry} locale="en-US" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when entry=null', () => {
    const { container } = render(<FilesDetailsDialog open entry={null} locale="en-US" onClose={vi.fn()} />);
    expect(container.querySelector('dialog')?.getAttribute('open')).toBeNull();
  });
});
