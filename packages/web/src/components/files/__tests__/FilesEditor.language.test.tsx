import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { FilesEditor } from '../FilesEditor';

const langSpy = vi.fn(async (_name: string) => null);
vi.mock('@/lib/languageForFilename', () => ({
  languageForFilename: (n: string) => langSpy(n),
}));
vi.mock('@uiw/react-codemirror', () => ({
  default: () => <div data-testid="cm-mock-language" />,
}));

describe('FilesEditor language selection', () => {
  it('calls languageForFilename with current filename on mount + change', async () => {
    const { rerender } = render(<FilesEditor filename="a.ts" value="" onChange={() => {}} onSave={() => {}} />);
    await waitFor(() => expect(langSpy).toHaveBeenCalledWith('a.ts'));
    rerender(<FilesEditor filename="b.py" value="" onChange={() => {}} onSave={() => {}} />);
    await waitFor(() => expect(langSpy).toHaveBeenCalledWith('b.py'));
  });
});
