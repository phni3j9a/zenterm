import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TerminalSearch, type TerminalSearchApi } from '../TerminalSearch';

function makeApi(): TerminalSearchApi {
  return {
    findNext: vi.fn(() => true),
    findPrevious: vi.fn(() => true),
    clearDecorations: vi.fn(),
  };
}

describe('TerminalSearch', () => {
  it('renders an input and calls findNext on Enter', () => {
    const api = makeApi();
    render(<TerminalSearch open api={api} onClose={vi.fn()} />);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(api.findNext).toHaveBeenCalledWith('hello', expect.any(Object));
  });

  it('Shift+Enter calls findPrevious', () => {
    const api = makeApi();
    render(<TerminalSearch open api={api} onClose={vi.fn()} />);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'hi' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(api.findPrevious).toHaveBeenCalledWith('hi', expect.any(Object));
  });

  it('Escape clears decorations and calls onClose', () => {
    const api = makeApi();
    const onClose = vi.fn();
    render(<TerminalSearch open api={api} onClose={onClose} />);
    const input = screen.getByRole('searchbox');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(api.clearDecorations).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('returns null when closed', () => {
    const api = makeApi();
    const { container } = render(<TerminalSearch open={false} api={api} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('toggles case sensitivity and passes it to findNext', () => {
    const api = makeApi();
    render(<TerminalSearch open api={api} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /case sensitive/i }));
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' });
    expect(api.findNext).toHaveBeenCalledWith('X', expect.objectContaining({ caseSensitive: true }));
  });
});
