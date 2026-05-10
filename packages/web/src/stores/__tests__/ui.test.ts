import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useUiStore } from '../ui';

describe('useUiStore', () => {
  beforeEach(() => {
    useUiStore.setState({ confirmDialog: null, toasts: [] });
  });

  it('showConfirm sets confirmDialog payload', () => {
    const onConfirm = vi.fn();
    useUiStore.getState().showConfirm({
      title: 'Delete',
      message: 'Sure?',
      destructive: true,
      onConfirm,
    });
    expect(useUiStore.getState().confirmDialog).toMatchObject({
      title: 'Delete',
      message: 'Sure?',
      destructive: true,
    });
  });

  it('hideConfirm clears confirmDialog', () => {
    useUiStore.getState().showConfirm({ title: 't', message: 'm', onConfirm: vi.fn() });
    useUiStore.getState().hideConfirm();
    expect(useUiStore.getState().confirmDialog).toBeNull();
  });

  it('pushToast appends with auto-generated id', () => {
    useUiStore.getState().pushToast({ type: 'info', message: 'hi' });
    useUiStore.getState().pushToast({ type: 'error', message: 'boom' });
    const toasts = useUiStore.getState().toasts;
    expect(toasts).toHaveLength(2);
    expect(toasts[0].message).toBe('hi');
    expect(toasts[0].id).not.toBe(toasts[1].id);
  });

  it('dismissToast removes by id', () => {
    useUiStore.getState().pushToast({ type: 'info', message: 'a' });
    useUiStore.getState().pushToast({ type: 'info', message: 'b' });
    const firstId = useUiStore.getState().toasts[0].id;
    useUiStore.getState().dismissToast(firstId);
    expect(useUiStore.getState().toasts.map((t) => t.message)).toEqual(['b']);
  });

  it('caps toasts queue at 5 entries (drops oldest)', () => {
    for (let i = 0; i < 7; i += 1) {
      useUiStore.getState().pushToast({ type: 'info', message: `t${i}` });
    }
    const toasts = useUiStore.getState().toasts;
    expect(toasts).toHaveLength(5);
    expect(toasts[0].message).toBe('t2');
    expect(toasts[4].message).toBe('t6');
  });
});
