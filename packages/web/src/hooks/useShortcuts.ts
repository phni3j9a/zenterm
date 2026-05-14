import { useEffect, useRef } from 'react';
import { matchShortcut, type ShortcutSpec } from '@/lib/keymap';
import type { PaneDirection } from '@/lib/paneLayout';

export interface ShortcutHandlers {
  toggleSidebar: () => void;
  openPalette: () => void;
  openSettings: () => void;
  /** windowOffset is 1..9 (matches ⌘1..⌘9). */
  jumpToWindow: (windowOffset: number) => void;
  newWindow: () => void;
  closeWindow: () => void;
  focusNextPane: () => void;
  focusPrevPane: () => void;
  focusPaneInDirection: (dir: PaneDirection) => void;
  openLayoutMenu: () => void;
  openSearch: () => void;
}

interface Binding {
  spec: ShortcutSpec;
  run: (ev: KeyboardEvent, handlers: ShortcutHandlers) => void;
}

const BINDINGS: Binding[] = [
  { spec: { key: 'b', mod: true }, run: (_e, h) => h.toggleSidebar() },
  { spec: { key: ',', mod: true }, run: (_e, h) => h.openSettings() },
  { spec: { key: 'k', mod: true }, run: (_e, h) => h.openPalette() },
  { spec: { key: 'f', mod: true }, run: (_e, h) => h.openSearch() },
  { spec: { key: '\\', mod: true }, run: (_e, h) => h.openLayoutMenu() },
  { spec: { key: 't', mod: true }, run: (_e, h) => h.newWindow() },
  { spec: { key: 'w', mod: true }, run: (_e, h) => h.closeWindow() },
  { spec: { key: '[', mod: true }, run: (_e, h) => h.focusPrevPane() },
  { spec: { key: ']', mod: true }, run: (_e, h) => h.focusNextPane() },
  { spec: { key: 'arrowleft', mod: true, shift: true }, run: (_e, h) => h.focusPaneInDirection('left') },
  { spec: { key: 'arrowright', mod: true, shift: true }, run: (_e, h) => h.focusPaneInDirection('right') },
  { spec: { key: 'arrowup', mod: true, shift: true }, run: (_e, h) => h.focusPaneInDirection('up') },
  { spec: { key: 'arrowdown', mod: true, shift: true }, run: (_e, h) => h.focusPaneInDirection('down') },
  ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map<Binding>((d) => ({
    spec: { key: d, mod: true },
    run: (_e, h) => h.jumpToWindow(Number(d)),
  })),
];

export function useShortcuts(handlers: ShortcutHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      for (const b of BINDINGS) {
        if (matchShortcut(ev, b.spec)) {
          ev.preventDefault();
          ev.stopPropagation();
          b.run(ev, handlersRef.current);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
}
