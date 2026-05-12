import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from '../Spinner';

describe('Spinner', () => {
  it('renders with role=status', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has default aria-label "Loading"', () => {
    render(<Spinner />);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('accepts custom aria-label', () => {
    render(<Spinner aria-label="Saving data" />);
    expect(screen.getByLabelText('Saving data')).toBeInTheDocument();
  });

  it('applies animation style', () => {
    render(<Spinner />);
    const el = screen.getByRole('status');
    expect(el.style.animation).toContain('zen-spin');
  });

  it('uses default size of 16px', () => {
    render(<Spinner />);
    const el = screen.getByRole('status');
    expect(el.style.width).toBe('16px');
    expect(el.style.height).toBe('16px');
  });

  it('accepts custom size prop', () => {
    render(<Spinner size={32} />);
    const el = screen.getByRole('status');
    expect(el.style.width).toBe('32px');
    expect(el.style.height).toBe('32px');
  });

  it('renders as inline-block span', () => {
    render(<Spinner />);
    const el = screen.getByRole('status');
    expect(el.tagName).toBe('SPAN');
    expect(el.style.display).toBe('inline-block');
  });
});
