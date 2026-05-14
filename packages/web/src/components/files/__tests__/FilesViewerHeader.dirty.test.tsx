import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { FilesViewerHeader } from '../FilesViewerHeader';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

interface RenderOpts {
  isDirty?: boolean;
  saving?: boolean;
}

function renderEditing(opts: RenderOpts = {}) {
  return render(
    <FilesViewerHeader
      name="a.ts"
      kind="text"
      isEditing
      isDirty={opts.isDirty ?? false}
      saving={opts.saving ?? false}
      showMarkdownRendered={false}
      onEdit={vi.fn()}
      onSave={vi.fn()}
      onCancel={vi.fn()}
      onDownload={vi.fn()}
      onToggleMarkdown={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

describe('FilesViewerHeader save button state', () => {
  it('save disabled when not dirty', () => {
    renderEditing({ isDirty: false });
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('save enabled when dirty', () => {
    renderEditing({ isDirty: true });
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled();
  });

  it('save disabled while saving even if dirty', () => {
    renderEditing({ isDirty: true, saving: true });
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });
});
