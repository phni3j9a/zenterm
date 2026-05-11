import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';

vi.mock('@/lib/events/client', () => ({
  TmuxEventsClient: vi.fn().mockImplementation(function () {
    return { start: vi.fn(), stop: vi.fn(), triggerReconnect: vi.fn() };
  }),
}));

vi.mock('@/components/terminal/XtermView', () => ({
  XtermView: () => null,
}));

const SYSTEM_STATUS = {
  cpu: { usage: 0, cores: 1, model: '', loadAvg: [0, 0, 0] },
  memory: { total: 1, used: 0, free: 1, percent: 0 },
  disk: { total: 1, used: 0, free: 1, percent: 0 },
  temperature: null,
  uptime: 100,
  gatewayVersion: '0.5.7',
};

function makePerUrlFetch(routes: Record<string, unknown>) {
  return vi.fn().mockImplementation((url: string) => {
    for (const [path, body] of Object.entries(routes)) {
      if ((url as string).endsWith(path)) {
        return Promise.resolve({
          ok: true, status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => body,
        });
      }
    }
    return Promise.resolve({
      ok: true, status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => [],
    });
  });
}

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
  useUiStore.setState({ confirmDialog: null, toasts: [] });
  vi.stubGlobal('fetch', makePerUrlFetch({
    '/api/sessions': [],
    '/api/system/status': SYSTEM_STATUS,
    '/api/claude/limits': { state: 'unconfigured' },
    '/api/codex/limits': { state: 'unconfigured' },
  }));
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => vi.restoreAllMocks());

describe('Settings gateway flow', () => {
  it('Copy URL writes to clipboard and shows toast', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/web/settings']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: /copy.*url/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /copy.*url/i }));
    await waitFor(() => expect(useUiStore.getState().toasts.length).toBeGreaterThan(0));
    unmount();
  });

  it('Logout clears auth and navigates to login', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/web/settings']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /logout/i }));
    const confirm = useUiStore.getState().confirmDialog;
    expect(confirm).not.toBeNull();
    confirm?.onConfirm();
    await waitFor(() => expect(useAuthStore.getState().token).toBeNull());
    unmount();
  });
});
