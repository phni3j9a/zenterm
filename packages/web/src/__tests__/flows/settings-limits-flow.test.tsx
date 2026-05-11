import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';

vi.mock('@/lib/events/client', () => ({
  TmuxEventsClient: vi.fn().mockImplementation(function () {
    return { start: vi.fn(), stop: vi.fn(), triggerReconnect: vi.fn() };
  }),
}));

vi.mock('@/components/terminal/XtermView', () => ({
  XtermView: () => null,
}));

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { (this as any).open = true; };
    HTMLDialogElement.prototype.close = function () { (this as any).open = false; };
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  });
});

beforeEach(() => {
  window.localStorage.clear();
  useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://localhost:3000' });
  useSettingsStore.setState({ themeMode: 'dark', language: 'en', fontSize: 14 } as any);

  const responses = new Map<string, any>([
    ['/api/sessions', []],
    ['/api/system/status', { cpu: { usage: 0, cores: 1, model: '', loadAvg: [0,0,0] }, memory: { total: 1, used: 0, free: 1, percent: 0 }, disk: { total: 1, used: 0, free: 1, percent: 0 }, temperature: null, uptime: 100, gatewayVersion: '0.5.7' }],
    ['/api/claude/limits', { state: 'unconfigured' }],
    ['/api/codex/limits', { state: 'unconfigured' }],
  ]);
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    for (const [path, body] of responses) {
      if (url.endsWith(path)) {
        return Promise.resolve({
          ok: true, status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => body,
        });
      }
    }
    return Promise.resolve({ ok: true, status: 200, headers: new Headers(), json: async () => null });
  }));
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

afterEach(() => vi.restoreAllMocks());

describe('Settings rate-limits flow', () => {
  it('Refresh button triggers Claude+Codex re-fetch', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/web/settings']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => {
      const calls = (fetch as any).mock.calls.map((c: any[]) => c[0] as string);
      expect(calls.some((u: string) => u.includes('/api/claude/limits'))).toBe(true);
      expect(calls.some((u: string) => u.includes('/api/codex/limits'))).toBe(true);
    });
    const initialCalls = (fetch as any).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => expect((fetch as any).mock.calls.length).toBeGreaterThan(initialCalls));
    unmount();
  });
});
