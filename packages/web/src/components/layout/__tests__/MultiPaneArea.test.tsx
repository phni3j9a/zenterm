import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { usePaneStore } from '@/stores/pane';
import { MultiPaneArea } from '../MultiPaneArea';
import type { UploadProgressApi } from '@/hooks/useUploadProgress';

function makeProgress(): UploadProgressApi {
  return {
    active: false,
    total: 0,
    completed: 0,
    currentFile: undefined,
    error: undefined,
    begin: vi.fn(),
    markStart: vi.fn(),
    markDone: vi.fn(),
    fail: vi.fn(),
    finish: vi.fn(),
  };
}

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
    <MultiPaneArea gatewayUrl="http://gw" token="tok" isVisible={isVisible} apiClient={null} uploadProgress={makeProgress()} />,
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

  it('cols-3 layout で 3 pane を描画し、grid columns が 1fr 1fr 1fr で均等', () => {
    usePaneStore.getState().setLayout('cols-3');
    const { container } = renderArea();
    expect(screen.getByTestId('pane-0')).toBeInTheDocument();
    expect(screen.getByTestId('pane-1')).toBeInTheDocument();
    expect(screen.getByTestId('pane-2')).toBeInTheDocument();
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.display).toBe('grid');
    expect(grid.style.gridTemplateColumns).toBe('1fr 1fr 1fr');
  });

  it('cols-2 で grid columns が 1fr 1fr', () => {
    usePaneStore.getState().setLayout('cols-2');
    const { container } = renderArea();
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('1fr 1fr');
  });

  it('grid-2x2 layout で 4 pane を描画し、grid が 2x2 で均等', () => {
    usePaneStore.getState().setLayout('grid-2x2');
    const { container } = renderArea();
    for (let i = 0; i < 4; i++) expect(screen.getByTestId(`pane-${i}`)).toBeInTheDocument();
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('1fr 1fr');
    expect(grid.style.gridTemplateRows).toBe('1fr 1fr');
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
    usePaneStore.getState().setFocusedIndex(1);
    rerender(<MultiPaneArea gatewayUrl="http://gw" token="tok" isVisible={true} apiClient={null} uploadProgress={makeProgress()} />);
    expect(screen.getByTestId('pane-0')).toBe(beforeP0);
    expect(screen.getByTestId('pane-1')).toBe(beforeP1);
  });
});
