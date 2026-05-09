import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '../Sidebar';

describe('Sidebar', () => {
  it('renders sessions panel and bottom nav with 3 buttons', () => {
    render(<Sidebar sessions={[]} activeSessionId={null} activeWindowIndex={null} onSelect={vi.fn()} />);
    expect(screen.getByLabelText(/Sessions panel/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sessions tab/i })).toBeInTheDocument();
    // Files / Settings tabs are present but disabled in Phase 1
    expect(screen.getByRole('button', { name: /Files tab/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Settings tab/i })).toBeDisabled();
  });
});
