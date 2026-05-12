import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('defaults to tone=neutral', () => {
    const { container } = render(<Badge>Neutral</Badge>);
    const el = container.querySelector('[data-tone]') as HTMLElement;
    expect(el).toHaveAttribute('data-tone', 'neutral');
  });

  it('applies tone=success data attribute', () => {
    const { container } = render(<Badge tone="success">OK</Badge>);
    expect(container.querySelector('[data-tone="success"]')).toBeInTheDocument();
  });

  it('applies tone=warning data attribute', () => {
    const { container } = render(<Badge tone="warning">Warn</Badge>);
    expect(container.querySelector('[data-tone="warning"]')).toBeInTheDocument();
  });

  it('applies tone=error data attribute', () => {
    const { container } = render(<Badge tone="error">Fail</Badge>);
    expect(container.querySelector('[data-tone="error"]')).toBeInTheDocument();
  });

  it('applies tone=info data attribute', () => {
    const { container } = render(<Badge tone="info">Info</Badge>);
    expect(container.querySelector('[data-tone="info"]')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<Badge icon={<span data-testid="ico">●</span>}>Status</Badge>);
    expect(screen.getByTestId('ico')).toBeInTheDocument();
  });

  it('does not render icon wrapper when icon omitted', () => {
    const { container } = render(<Badge>No icon</Badge>);
    // Only the outer span and text node — no nested aria-hidden span
    expect(container.querySelector('[aria-hidden]')).toBeNull();
  });

  it('icon wrapper has aria-hidden', () => {
    const { container } = render(<Badge icon={<span>★</span>}>With icon</Badge>);
    const iconWrapper = container.querySelector('[aria-hidden]');
    expect(iconWrapper).toBeInTheDocument();
  });
});
