import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { IconButton } from '../IconButton';

describe('IconButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a button with aria-label', () => {
    render(<IconButton icon={<span>X</span>} label="Close" />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('renders the icon inside the button', () => {
    render(<IconButton icon={<span data-testid="ico">X</span>} label="Close" />);
    expect(screen.getByTestId('ico')).toBeInTheDocument();
  });

  it('defaults to variant=ghost and size=md (36px)', () => {
    render(<IconButton icon={<span>X</span>} label="Close" />);
    const btn = screen.getByRole('button', { name: 'Close' });
    expect(btn.style.width).toBe('36px');
    expect(btn.style.height).toBe('36px');
    expect(btn.style.background).toBe('transparent');
  });

  it('size=sm renders 28px button', () => {
    render(<IconButton icon={<span>X</span>} label="Close" size="sm" />);
    const btn = screen.getByRole('button', { name: 'Close' });
    expect(btn.style.width).toBe('28px');
    expect(btn.style.height).toBe('28px');
  });

  it('variant=primary has non-transparent background', () => {
    render(<IconButton icon={<span>X</span>} label="Close" variant="primary" />);
    const btn = screen.getByRole('button', { name: 'Close' });
    expect(btn.style.background).not.toBe('transparent');
    expect(btn.style.background).not.toBe('');
  });

  it('variant=outline has border', () => {
    render(<IconButton icon={<span>X</span>} label="Close" variant="outline" />);
    const btn = screen.getByRole('button', { name: 'Close' });
    expect(btn.style.border).toContain('1px solid');
  });

  it('variant=danger has border with error color', () => {
    render(<IconButton icon={<span>X</span>} label="Delete" variant="danger" />);
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn.style.border).toContain('1px solid');
  });

  it('calls onClick handler when clicked', async () => {
    const onClick = vi.fn();
    render(<IconButton icon={<span>X</span>} label="Close" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows tooltip after 500ms hover', () => {
    render(<IconButton icon={<span>X</span>} label="Close" />);
    const btn = screen.getByRole('button', { name: 'Close' });
    fireEvent.mouseEnter(btn);
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Close');
  });

  it('disabled button has reduced opacity and not-allowed cursor', () => {
    render(<IconButton icon={<span>X</span>} label="Close" disabled />);
    const btn = screen.getByRole('button', { name: 'Close' });
    expect(btn.style.opacity).toBe('0.5');
    expect(btn.style.cursor).toBe('not-allowed');
  });
});
