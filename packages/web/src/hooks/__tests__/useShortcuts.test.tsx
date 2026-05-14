import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useShortcuts, type ShortcutHandlers } from '../useShortcuts';

function dispatch(ev: Partial<KeyboardEvent>) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...ev });
  window.dispatchEvent(event);
  return event;
}

describe('useShortcuts', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fires toggleSidebar on ⌘B and prevents default', () => {
    const handlers: ShortcutHandlers = {
      toggleSidebar: vi.fn(),
      openPalette: vi.fn(),
      openSettings: vi.fn(),
      jumpToWindow: vi.fn(),
      newWindow: vi.fn(),
      closeWindow: vi.fn(),
      focusNextPane: vi.fn(),
      focusPrevPane: vi.fn(),
      focusPaneInDirection: vi.fn(),
      openLayoutMenu: vi.fn(),
      openSearch: vi.fn(),
    };
    renderHook(() => useShortcuts(handlers));
    const ev = dispatch({ key: 'b', metaKey: true });
    expect(handlers.toggleSidebar).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('fires openSettings on ⌘,', () => {
    const handlers: ShortcutHandlers = {
      toggleSidebar: vi.fn(),
      openPalette: vi.fn(),
      openSettings: vi.fn(),
      jumpToWindow: vi.fn(),
      newWindow: vi.fn(),
      closeWindow: vi.fn(),
      focusNextPane: vi.fn(),
      focusPrevPane: vi.fn(),
      focusPaneInDirection: vi.fn(),
      openLayoutMenu: vi.fn(),
      openSearch: vi.fn(),
    };
    renderHook(() => useShortcuts(handlers));
    dispatch({ key: ',', metaKey: true });
    expect(handlers.openSettings).toHaveBeenCalledTimes(1);
  });

  it('ignores unrelated keys', () => {
    const handlers: ShortcutHandlers = {
      toggleSidebar: vi.fn(),
      openPalette: vi.fn(),
      openSettings: vi.fn(),
      jumpToWindow: vi.fn(),
      newWindow: vi.fn(),
      closeWindow: vi.fn(),
      focusNextPane: vi.fn(),
      focusPrevPane: vi.fn(),
      focusPaneInDirection: vi.fn(),
      openLayoutMenu: vi.fn(),
      openSearch: vi.fn(),
    };
    renderHook(() => useShortcuts(handlers));
    dispatch({ key: 'b' });
    expect(handlers.toggleSidebar).not.toHaveBeenCalled();
  });

  it('fires focusPaneInDirection on ⌘+Shift+矢印 and prevents default', () => {
    const handlers: ShortcutHandlers = {
      toggleSidebar: vi.fn(),
      openPalette: vi.fn(),
      openSettings: vi.fn(),
      jumpToWindow: vi.fn(),
      newWindow: vi.fn(),
      closeWindow: vi.fn(),
      focusNextPane: vi.fn(),
      focusPrevPane: vi.fn(),
      focusPaneInDirection: vi.fn(),
      openLayoutMenu: vi.fn(),
      openSearch: vi.fn(),
    };
    renderHook(() => useShortcuts(handlers));

    const left = dispatch({ key: 'ArrowLeft', metaKey: true, shiftKey: true });
    expect(handlers.focusPaneInDirection).toHaveBeenNthCalledWith(1, 'left');
    expect(left.defaultPrevented).toBe(true);

    dispatch({ key: 'ArrowRight', metaKey: true, shiftKey: true });
    expect(handlers.focusPaneInDirection).toHaveBeenNthCalledWith(2, 'right');

    dispatch({ key: 'ArrowUp', metaKey: true, shiftKey: true });
    expect(handlers.focusPaneInDirection).toHaveBeenNthCalledWith(3, 'up');

    dispatch({ key: 'ArrowDown', metaKey: true, shiftKey: true });
    expect(handlers.focusPaneInDirection).toHaveBeenNthCalledWith(4, 'down');
  });

  it('does not fire focusPaneInDirection without Shift', () => {
    const handlers: ShortcutHandlers = {
      toggleSidebar: vi.fn(),
      openPalette: vi.fn(),
      openSettings: vi.fn(),
      jumpToWindow: vi.fn(),
      newWindow: vi.fn(),
      closeWindow: vi.fn(),
      focusNextPane: vi.fn(),
      focusPrevPane: vi.fn(),
      focusPaneInDirection: vi.fn(),
      openLayoutMenu: vi.fn(),
      openSearch: vi.fn(),
    };
    renderHook(() => useShortcuts(handlers));
    dispatch({ key: 'ArrowLeft', metaKey: true });
    expect(handlers.focusPaneInDirection).not.toHaveBeenCalled();
  });

  it('does not re-register on identical handler refs across re-renders', () => {
    const handlers: ShortcutHandlers = {
      toggleSidebar: vi.fn(),
      openPalette: vi.fn(),
      openSettings: vi.fn(),
      jumpToWindow: vi.fn(),
      newWindow: vi.fn(),
      closeWindow: vi.fn(),
      focusNextPane: vi.fn(),
      focusPrevPane: vi.fn(),
      focusPaneInDirection: vi.fn(),
      openLayoutMenu: vi.fn(),
      openSearch: vi.fn(),
    };
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { rerender } = renderHook(() => useShortcuts(handlers));
    const initialCalls = addSpy.mock.calls.filter((c) => c[0] === 'keydown').length;
    rerender();
    rerender();
    const afterCalls = addSpy.mock.calls.filter((c) => c[0] === 'keydown').length;
    expect(afterCalls).toBe(initialCalls);
  });
});
