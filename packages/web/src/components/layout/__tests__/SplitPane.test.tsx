import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { SplitPane } from '../SplitPane';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

function setup(props: Partial<React.ComponentProps<typeof SplitPane>> = {}) {
  const onChange = vi.fn();
  render(
    <div style={{ width: 800, height: 600 }}>
      <SplitPane
        orientation={props.orientation ?? 'vertical'}
        ratio={props.ratio ?? 0.5}
        onRatioChange={onChange}
        first={<div data-testid="first">First</div>}
        second={<div data-testid="second">Second</div>}
      />
    </div>,
  );
  return { onChange };
}

describe('SplitPane', () => {
  it('first / second の両方を描画する', () => {
    setup();
    expect(screen.getByTestId('first')).toBeInTheDocument();
    expect(screen.getByTestId('second')).toBeInTheDocument();
  });

  it('vertical orientation で splitter は col-resize cursor', () => {
    setup({ orientation: 'vertical' });
    const splitter = screen.getByRole('separator');
    expect(splitter.style.cursor).toBe('col-resize');
  });

  it('horizontal orientation で splitter は row-resize cursor', () => {
    setup({ orientation: 'horizontal' });
    const splitter = screen.getByRole('separator');
    expect(splitter.style.cursor).toBe('row-resize');
  });

  it('splitter ドラッグで onRatioChange が呼ばれる (vertical)', () => {
    const { onChange } = setup({ orientation: 'vertical', ratio: 0.5 });
    const splitter = screen.getByRole('separator');
    const container = splitter.parentElement as HTMLElement;
    // jsdom は getBoundingClientRect を返すが値はゼロ。クラスを介してテスト
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }),
    });
    fireEvent.pointerDown(splitter, { clientX: 400, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 600, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 600, clientY: 300, pointerId: 1 });
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last).toBeGreaterThan(0.5);
    expect(last).toBeLessThanOrEqual(0.9);
  });

  it('separator は aria-orientation を持つ', () => {
    setup({ orientation: 'vertical' });
    expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe('vertical');
  });
});
