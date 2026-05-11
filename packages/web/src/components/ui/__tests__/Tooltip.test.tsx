// NOTE: userEvent.setup({ advanceTimers }) hangs in this Vitest 4 / userEvent v14 / jsdom 25
// environment (every userEvent call internally uses setTimeout which fake timers don't
// resolve in this setup). We use fireEvent + vi.advanceTimersByTime + fireEvent.keyDown
// instead — the behavioural coverage is identical.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { Tooltip } from '../Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the trigger child immediately', () => {
    render(
      <Tooltip label="hello">
        <button>btn</button>
      </Tooltip>,
    );
    expect(screen.getByRole('button', { name: 'btn' })).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows the tooltip after 500ms hover and links via aria-describedby', () => {
    render(
      <Tooltip label="hello">
        <button>btn</button>
      </Tooltip>,
    );
    const btn = screen.getByRole('button', { name: 'btn' });
    fireEvent.mouseEnter(btn);
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('hello');
    expect(btn).toHaveAttribute('aria-describedby', tip.id);
  });

  it('hides on unhover before delay elapses', () => {
    render(
      <Tooltip label="hello">
        <button>btn</button>
      </Tooltip>,
    );
    const btn = screen.getByRole('button', { name: 'btn' });
    fireEvent.mouseEnter(btn);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.mouseLeave(btn);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('hides on Escape', () => {
    render(
      <Tooltip label="hello">
        <button>btn</button>
      </Tooltip>,
    );
    const btn = screen.getByRole('button', { name: 'btn' });
    fireEvent.mouseEnter(btn);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
