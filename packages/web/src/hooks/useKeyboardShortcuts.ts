import { useEffect } from 'react';
import { useSessionsStore } from '../stores/sessions';

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

/**
 * Global keyboard shortcuts for terminal tab management.
 * Ctrl+T: new tab, Ctrl+W: close tab, Ctrl+Tab/Shift+Tab: cycle tabs.
 * These overlap with browser defaults — they are intercepted best-effort
 * via preventDefault. Ctrl+Tab in particular may not work in all browsers.
 * Shortcuts are suppressed when editable controls (input/textarea) are focused.
 */
export function useKeyboardShortcuts() {
  const createSession = useSessionsStore((s) => s.createSession);
  const closeTab = useSessionsStore((s) => s.closeTab);
  const openTabs = useSessionsStore((s) => s.openTabs);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const setActiveSession = useSessionsStore((s) => s.setActiveSession);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (isEditableTarget(e.target)) return;

      // Ctrl+T → new tab
      if (e.key === 't' && !e.shiftKey) {
        e.preventDefault();
        createSession();
        return;
      }

      // Ctrl+W → close active tab
      if (e.key === 'w' && !e.shiftKey) {
        e.preventDefault();
        if (activeSessionId) closeTab(activeSessionId);
        return;
      }

      // Ctrl+Tab / Ctrl+Shift+Tab → cycle tabs (best-effort)
      if (e.key === 'Tab') {
        e.preventDefault();
        if (openTabs.length < 2 || !activeSessionId) return;
        const idx = openTabs.indexOf(activeSessionId);
        const next = e.shiftKey
          ? (idx - 1 + openTabs.length) % openTabs.length
          : (idx + 1) % openTabs.length;
        setActiveSession(openTabs[next]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createSession, closeTab, openTabs, activeSessionId, setActiveSession]);
}
