import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { IconTerminal, IconFolder, IconRocket, IconChevronRight, IconHome } from '../index';

describe('icons barrel', () => {
  it('renders IconTerminal as svg', () => {
    const { container } = render(<IconTerminal size={16} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
  it('renders IconFolder', () => {
    const { container } = render(<IconFolder size={16} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
  it('renders IconRocket at size 32', () => {
    const { container } = render(<IconRocket size={32} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('width')).toBe('32');
  });
  it('renders IconChevronRight', () => {
    const { container } = render(<IconChevronRight size={14} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
  it('renders IconHome with custom aria-hidden', () => {
    const { container } = render(<IconHome size={16} aria-hidden />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});
