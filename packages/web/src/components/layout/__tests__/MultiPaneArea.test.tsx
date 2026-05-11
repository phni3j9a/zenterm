import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { usePaneStore } from '@/stores/pane';
import { MultiPaneArea } from '../MultiPaneArea';

vi.mock('@/components/TerminalPane', () => ({
  TerminalPane: ({
    sessionId,
    paneIndex,
    isFocused,
    isVisible,
  }: { sessionId: string | null; paneIndex: number; isFocused: boolean; isVisible: boolean }) => (
    <div
      data-testid={`pane-${paneIndex}`}
      data-session={sessionId ?? ''}
      data-focused={String(isFocused)}
      data-visible={String(isVisible)}
    />
  ),
}));

beforeEach(() => {
  window.localStorage.clear();
  usePaneStore.setState({
    layout: 'single',
    panes: [null],
    focusedIndex: 0,
    ratios: {
      single: [],
      'cols-2': [0.5],
      'cols-3': [1 / 3, 0.5],
      'grid-2x2': [0.5, 0.5],
      'main-side-2': [0.6, 0.5],
    },
    savedLayout: null,
  });
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

function renderArea(isVisible = true) {
  return render(
    <MultiPaneArea gatewayUrl="http://gw" token="tok" isVisible={isVisible} />,
  );
}

describe('MultiPaneArea', () => {
  it('single layout で 1 pane を描画 (paneIndex=0, focused=true)', () => {
    usePaneStore.getState().assignPane(0, { sessionId: 's1', windowIndex: 0 });
    renderArea();
    const p0 = screen.getByTestId('pane-0');
    expect(p0.getAttribute('data-session')).toBe('s1');
    expect(p0.getAttribute('data-focused')).toBe('true');
  });

  it('cols-2 layout で 2 pane を描画、focused のみ data-focused=true', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(0, { sessionId: 'a', windowIndex: 0 });
    usePaneStore.getState().assignPane(1, { sessionId: 'b', windowIndex: 0 });
    usePaneStore.getState().setFocusedIndex(1);
    renderArea();
    expect(screen.getByTestId('pane-0').getAttribute('data-focused')).toBe('false');
    expect(screen.getByTestId('pane-1').getAttribute('data-focused')).toBe('true');
  });

  it('cols-3 layout で 3 pane を描画', () => {
    usePaneStore.getState().setLayout('cols-3');
    renderArea();
    expect(screen.getByTestId('pane-0')).toBeInTheDocument();
    expect(screen.getByTestId('pane-1')).toBeInTheDocument();
    expect(screen.getByTestId('pane-2')).toBeInTheDocument();
  });

  it('grid-2x2 layout で 4 pane を描画', () => {
    usePaneStore.getState().setLayout('grid-2x2');
    renderArea();
    for (let i = 0; i < 4; i++) expect(screen.getByTestId(`pane-${i}`)).toBeInTheDocument();
  });

  it('main-side-2 layout で 3 pane を描画', () => {
    usePaneStore.getState().setLayout('main-side-2');
    renderArea();
    for (let i = 0; i < 3; i++) expect(screen.getByTestId(`pane-${i}`)).toBeInTheDocument();
  });

  it('isVisible=false のとき全 pane が data-visible=false', () => {
    usePaneStore.getState().setLayout('cols-2');
    renderArea(false);
    expect(screen.getByTestId('pane-0').getAttribute('data-visible')).toBe('false');
    expect(screen.getByTestId('pane-1').getAttribute('data-visible')).toBe('false');
  });

  it('pane クリックで focusedIndex が変わる', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().setFocusedIndex(0);
    renderArea();
    fireEvent.click(screen.getByTestId('pane-1').parentElement as HTMLElement);
    expect(usePaneStore.getState().focusedIndex).toBe(1);
  });

  it('同 layout 内で focus 変更しても TerminalPane は remount されない', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(0, { sessionId: 'a', windowIndex: 0 });
    usePaneStore.getState().assignPane(1, { sessionId: 'b', windowIndex: 0 });
    usePaneStore.getState().setFocusedIndex(0);
    const { rerender } = renderArea();
    const beforeP0 = screen.getByTestId('pane-0');
    const beforeP1 = screen.getByTestId('pane-1');
    // Change focus only (no layout change)
    usePaneStore.getState().setFocusedIndex(1);
    rerender(<MultiPaneArea gatewayUrl="http://gw" token="tok" isVisible={true} />);
    expect(screen.getByTestId('pane-0')).toBe(beforeP0);
    expect(screen.getByTestId('pane-1')).toBe(beforeP1);
  });

  it('同 layout 内で ratio 変更しても TerminalPane は remount されない', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(0, { sessionId: 'a', windowIndex: 0 });
    usePaneStore.getState().assignPane(1, { sessionId: 'b', windowIndex: 0 });
    const { rerender } = renderArea();
    const beforeP0 = screen.getByTestId('pane-0');
    usePaneStore.getState().setRatio('cols-2', 0, 0.7);
    rerender(<MultiPaneArea gatewayUrl="http://gw" token="tok" isVisible={true} />);
    expect(screen.getByTestId('pane-0')).toBe(beforeP0);
  });
});
