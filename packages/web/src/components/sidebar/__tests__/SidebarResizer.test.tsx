import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SidebarResizer } from '../SidebarResizer';
import { useLayoutStore } from '@/stores/layout';

// rAF を即時実行 (テスト用)
function mockRaf() {
  return vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0);
    return 1 as unknown as number;
  });
}

describe('SidebarResizer', () => {
  beforeEach(() => {
    localStorage.clear();
    useLayoutStore.setState({ sidebarWidth: 320, sidebarCollapsed: false });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a separator with ARIA attributes', () => {
    render(<SidebarResizer />);
    const handle = screen.getByRole('separator');
    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    expect(handle).toHaveAttribute('aria-valuemin', '240');
    expect(handle).toHaveAttribute('aria-valuemax', '480');
    expect(handle).toHaveAttribute('aria-valuenow', '320');
  });

  it('updates sidebarWidth on pointer drag (rAF flushed)', () => {
    mockRaf();
    render(<SidebarResizer />);
    const handle = screen.getByRole('separator');
    fireEvent.pointerDown(handle, { clientX: 320, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 400 });
    fireEvent.pointerUp(window);
    expect(useLayoutStore.getState().sidebarWidth).toBe(400);
  });

  it('clamps drag below min to 240', () => {
    mockRaf();
    render(<SidebarResizer />);
    const handle = screen.getByRole('separator');
    fireEvent.pointerDown(handle, { clientX: 320, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 100 });
    fireEvent.pointerUp(window);
    expect(useLayoutStore.getState().sidebarWidth).toBe(240);
  });

  it('clamps drag above max to 480', () => {
    mockRaf();
    render(<SidebarResizer />);
    const handle = screen.getByRole('separator');
    fireEvent.pointerDown(handle, { clientX: 320, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 700 });
    fireEvent.pointerUp(window);
    expect(useLayoutStore.getState().sidebarWidth).toBe(480);
  });

  it('ArrowRight / ArrowLeft adjust by 16px', () => {
    render(<SidebarResizer />);
    const handle = screen.getByRole('separator');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(useLayoutStore.getState().sidebarWidth).toBe(336);
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(useLayoutStore.getState().sidebarWidth).toBe(304);
  });

  it('cleans up listeners on unmount', () => {
    const { unmount } = render(<SidebarResizer />);
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    unmount();
    // unmount 後の pointermove で width は変わらない (= listener は外れている)
    fireEvent.pointerMove(window, { clientX: 999 });
    expect(useLayoutStore.getState().sidebarWidth).toBe(320);
    removeSpy.mockRestore();
  });
});
