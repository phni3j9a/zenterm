import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { FilesNewNameDialog } from '../FilesNewNameDialog';

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

describe('FilesNewNameDialog', () => {
  it('renders with title and placeholder', () => {
    render(<FilesNewNameDialog open title="New file" placeholder="filename.ext" initialValue="" onCancel={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText('New file')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('filename.ext')).toBeInTheDocument();
  });

  it('submit fires onSubmit with trimmed value', () => {
    const onSubmit = vi.fn();
    render(<FilesNewNameDialog open title="t" placeholder="p" initialValue="  abc  " onCancel={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /ok|create/i }));
    expect(onSubmit).toHaveBeenCalledWith('abc');
  });

  it('cancel fires onCancel', () => {
    const onCancel = vi.fn();
    render(<FilesNewNameDialog open title="t" placeholder="p" initialValue="" onCancel={onCancel} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not submit empty', () => {
    const onSubmit = vi.fn();
    render(<FilesNewNameDialog open title="t" placeholder="p" initialValue="   " onCancel={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /ok|create/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
