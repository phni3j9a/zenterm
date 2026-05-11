import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// matchMedia stub for theme
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
    const { container } = render(
      <TerminalDropZone cwd="/home/user" onFiles={vi.fn()} />,
    );
    // role="region" with aria-label containing "drop" should not exist
    const region = container.querySelector('[role="region"]');
    expect(region).toBeNull();
  });

  it('shows overlay after window dragenter with Files type', () => {
    render(<TerminalDropZone cwd="/home/user" onFiles={vi.fn()} />);

    fireEvent(
      window,
      Object.assign(new Event('dragenter'), makeDragEvent(['Files'])),
    );

    const region = screen.getByRole('region');
    expect(region).toBeTruthy();
  });

  it('calls onFiles(files, cwd) when files are dropped on the overlay', () => {
    const onFiles = vi.fn();
    render(<TerminalDropZone cwd="/home/server/proj" onFiles={onFiles} />);

    // activate overlay
    fireEvent(
      window,
      Object.assign(new Event('dragenter'), makeDragEvent(['Files'])),
    );

    const region = screen.getByRole('region');

    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    fireEvent.drop(region, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(onFiles).toHaveBeenCalledWith([file], '/home/server/proj');
  });
});
