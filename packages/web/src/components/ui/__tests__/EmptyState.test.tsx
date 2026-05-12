import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No results" />);
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('has role=status', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="Try adding some items" />);
    expect(screen.getByText('Try adding some items')).toBeInTheDocument();
  });

  it('does not render description when omitted', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByText('Try adding some items')).toBeNull();
  });

  it('renders icon when provided', () => {
    render(<EmptyState title="Empty" icon={<span data-testid="icon">★</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('does not render icon container when icon omitted', () => {
    const { container } = render(<EmptyState title="Empty" />);
    // no extra icon div — just title text
    expect(container.querySelectorAll('div').length).toBe(2); // outer + title
  });

  it('renders action when provided', () => {
    render(<EmptyState title="Empty" action={<button>Add item</button>} />);
    expect(screen.getByRole('button', { name: 'Add item' })).toBeInTheDocument();
  });

  it('applies smaller padding for size=sm', () => {
    render(<EmptyState title="Empty" size="sm" />);
    const status = screen.getByRole('status');
    // sm uses xl (20px) padding-top/bottom vs md uses 4xl (48px)
    expect(status.style.padding).toContain('20px');
  });
});
