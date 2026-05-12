import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from '../Skeleton';

describe('Skeleton', () => {
  it('renders a span element', () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector('span')).toBeInTheDocument();
  });

  it('is aria-hidden', () => {
    const { container } = render(<Skeleton />);
    const el = container.querySelector('span');
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses default height of 16px', () => {
    const { container } = render(<Skeleton />);
    const el = container.querySelector('span') as HTMLSpanElement;
    expect(el.style.height).toBe('16px');
  });

  it('uses default width of 100%', () => {
    const { container } = render(<Skeleton />);
    const el = container.querySelector('span') as HTMLSpanElement;
    expect(el.style.width).toBe('100%');
  });

  it('accepts custom width and height', () => {
    const { container } = render(<Skeleton width={200} height={40} />);
    const el = container.querySelector('span') as HTMLSpanElement;
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('40px');
  });

  it('accepts string width', () => {
    const { container } = render(<Skeleton width="50%" />);
    const el = container.querySelector('span') as HTMLSpanElement;
    expect(el.style.width).toBe('50%');
  });

  it('applies custom border-radius', () => {
    const { container } = render(<Skeleton radius={8} />);
    const el = container.querySelector('span') as HTMLSpanElement;
    expect(el.style.borderRadius).toBe('8px');
  });
});
