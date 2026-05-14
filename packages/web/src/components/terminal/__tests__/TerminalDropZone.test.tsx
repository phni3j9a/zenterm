import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

import { TerminalDropZone } from '../TerminalDropZone';

function makeDragEvent(types: string[]): Partial<DragEvent> {
  return {
    dataTransfer: { types } as unknown as DataTransfer,
    preventDefault: vi.fn(),
  };
}

describe('TerminalDropZone', () => {
  it('renders nothing when inactive (no drag over window)', () => {
    const { container } = render(<TerminalDropZone onFiles={vi.fn()} />);
    const region = container.querySelector('[role="region"]');
    expect(region).toBeNull();
  });

  it('shows overlay after window dragenter with Files type', () => {
    render(<TerminalDropZone onFiles={vi.fn()} />);
    fireEvent(
      window,
      Object.assign(new Event('dragenter'), makeDragEvent(['Files'])),
    );
    const region = screen.getByRole('region');
    expect(region).toBeTruthy();
  });

  it('calls onFiles(files) when files are dropped on the overlay', () => {
    const onFiles = vi.fn();
    render(<TerminalDropZone onFiles={onFiles} />);
    fireEvent(
      window,
      Object.assign(new Event('dragenter'), makeDragEvent(['Files'])),
    );
    const region = screen.getByRole('region');
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    fireEvent.drop(region, { dataTransfer: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
  });
});
