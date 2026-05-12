import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '../Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Hello Card</Card>);
    expect(screen.getByText('Hello Card')).toBeInTheDocument();
  });

  it('defaults to variant=elevated with box-shadow', () => {
    render(<Card>content</Card>);
    const el = screen.getByText('content').parentElement ?? screen.getByText('content');
    // The wrapping div is the card itself
    const card = screen.getByText('content');
    expect(card).toHaveAttribute('data-variant', 'elevated');
    expect(card.style.boxShadow).not.toBe('none');
    expect(card.style.boxShadow).not.toBe('');
  });

  it('variant=outline adds border and no shadow', () => {
    render(<Card variant="outline">content</Card>);
    const card = screen.getByText('content');
    expect(card).toHaveAttribute('data-variant', 'outline');
    expect(card.style.border).toContain('1px solid');
    expect(card.style.boxShadow).toBe('none');
  });

  it('variant=plain has no shadow and data-variant=plain', () => {
    render(<Card variant="plain">content</Card>);
    const card = screen.getByText('content');
    expect(card).toHaveAttribute('data-variant', 'plain');
    expect(card.style.boxShadow).toBe('none');
    // jsdom normalizes border:none → borderStyle:none
    expect(card.style.borderStyle).toBe('none');
  });

  it('does not render role=region without aria-label or aria-labelledby', () => {
    render(<Card>content</Card>);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('renders role=region when aria-label is provided', () => {
    render(<Card aria-label="My Card">content</Card>);
    expect(screen.getByRole('region', { name: 'My Card' })).toBeInTheDocument();
  });

  it('renders role=region when aria-labelledby is provided', () => {
    render(
      <>
        <span id="card-title">Card Title</span>
        <Card aria-labelledby="card-title">content</Card>
      </>,
    );
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('accepts custom style prop', () => {
    render(<Card style={{ marginTop: 42 }}>content</Card>);
    const card = screen.getByText('content');
    expect(card.style.marginTop).toBe('42px');
  });
});
