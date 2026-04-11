import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../stores/settings';

const QUIET_THRESHOLD_MS = 10_000; // 10s of silence before notifying
const DEBOUNCE_MS = 5_000;

/**
 * Sends a browser Notification when terminal output arrives
 * while the tab is hidden and the session was quiet for QUIET_THRESHOLD_MS.
 */
export function useTerminalNotifications(sessionId: string | null) {
  const enabled = useSettingsStore((s) => s.notificationsEnabled);
  const lastOutputRef = useRef<number>(Date.now());
  const notifiedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset on session change
  useEffect(() => {
    lastOutputRef.current = Date.now();
    notifiedRef.current = false;
  }, [sessionId]);

  // Reset notified flag on focus
  useEffect(() => {
    const handleFocus = () => {
      notifiedRef.current = false;
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Return a callback to be called when output arrives
  const onOutput = useRef((data: string) => {
    const now = Date.now();
    const wasQuiet = now - lastOutputRef.current > QUIET_THRESHOLD_MS;
    lastOutputRef.current = now;

    if (
      !enabled ||
      !document.hidden ||
      notifiedRef.current ||
      !wasQuiet ||
      !data.trim()
    ) {
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if ('Notification' in window && Notification.permission === 'granted') {
        const preview = data.trim().slice(0, 80);
        new Notification('ZenTerm', {
          body: `[${sessionId ?? 'terminal'}] ${preview}`,
          tag: 'zenterm-activity',
        });
        notifiedRef.current = true;
      }
    }, DEBOUNCE_MS);
  });

  // Keep the ref's closure fresh
  useEffect(() => {
    onOutput.current = (data: string) => {
      const now = Date.now();
      const wasQuiet = now - lastOutputRef.current > QUIET_THRESHOLD_MS;
      lastOutputRef.current = now;

      if (
        !enabled ||
        !document.hidden ||
        notifiedRef.current ||
        !wasQuiet ||
        !data.trim()
      ) {
        return;
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if ('Notification' in window && Notification.permission === 'granted') {
          const preview = data.trim().slice(0, 80);
          new Notification('ZenTerm', {
            body: `[${sessionId ?? 'terminal'}] ${preview}`,
            tag: 'zenterm-activity',
          });
          notifiedRef.current = true;
        }
      }, DEBOUNCE_MS);
    };
  }, [enabled, sessionId]);

  return onOutput;
}
