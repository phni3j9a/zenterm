import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { FilesEditor } from '../FilesEditor';

// Mock CodeMirror so we don't need a real DOM-mounted editor in jsdom.
vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange, onKeyDown }: { value: string; onChange?: (v: string) => void; onKeyDown?: (e: React.KeyboardEvent) => void }) => (
    <textarea
      data-testid="cm-mock"
      defaultValue={value}
      onChange={(e) => onChange?.(e.target.value)}
      onKeyDown={onKeyDown}
    />
  ),
}));

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

describe('FilesEditor', () => {
  it('renders with initial value', async () => {
    render(<FilesEditor filename="a.ts" value="hi" onChange={() => {}} onSave={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('cm-mock')).toHaveValue('hi'));
  });

  it('calls onChange when text edited', async () => {
    const onChange = vi.fn();
    render(<FilesEditor filename="a.ts" value="hi" onChange={onChange} onSave={() => {}} />);
    const ta = await screen.findByTestId('cm-mock');
    fireEvent.change(ta, { target: { value: 'changed' } });
    expect(onChange).toHaveBeenCalledWith('changed');
  });

  it('calls onSave when Cmd+S is pressed', async () => {
    const onSave = vi.fn();
    render(<FilesEditor filename="a.ts" value="hi" onChange={() => {}} onSave={onSave} />);
    const ta = await screen.findByTestId('cm-mock');
    fireEvent.keyDown(ta, { key: 's', metaKey: true });
    expect(onSave).toHaveBeenCalled();
  });

  it('calls onSave when Ctrl+S is pressed', async () => {
    const onSave = vi.fn();
    render(<FilesEditor filename="a.ts" value="hi" onChange={() => {}} onSave={onSave} />);
    const ta = await screen.findByTestId('cm-mock');
    fireEvent.keyDown(ta, { key: 's', ctrlKey: true });
    expect(onSave).toHaveBeenCalled();
  });
});
