import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilesBreadcrumbs } from '../FilesBreadcrumbs';

describe('FilesBreadcrumbs', () => {
  it('renders Home root when path = ~', () => {
    const onNavigate = vi.fn();
    render(<FilesBreadcrumbs path="~" onNavigate={onNavigate} />);
    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
  });

  it('renders segments for ~/a/b', () => {
    const onNavigate = vi.fn();
    render(<FilesBreadcrumbs path="~/a/b" onNavigate={onNavigate} />);
    expect(screen.getByRole('button', { name: /^a$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^b$/ })).toBeInTheDocument();
  });

  it('clicking a segment fires onNavigate with that path', () => {
    const onNavigate = vi.fn();
    render(<FilesBreadcrumbs path="~/a/b" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: /^a$/ }));
    expect(onNavigate).toHaveBeenCalledWith('~/a');
  });

  it('clicking Home fires onNavigate("~")', () => {
    const onNavigate = vi.fn();
    render(<FilesBreadcrumbs path="~/a/b" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: /home/i }));
    expect(onNavigate).toHaveBeenCalledWith('~');
  });
});
