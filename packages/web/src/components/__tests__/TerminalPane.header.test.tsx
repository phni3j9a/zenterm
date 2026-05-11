import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, act, waitFor } from '@testing-library/react';
import { useSessionsStore } from '@/stores/sessions';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { initI18n } from '@/i18n';

vi.mock('@/components/terminal/XtermView', () => ({
  XtermView: () => <div data-testid="mock-xterm" />,
}));

import { TerminalPane } from '../TerminalPane';

beforeEach(() => {
  useSettingsStore.setState({ language: 'en', fontSize: 14 } as any);
  initI18n();
  useSessionsStore.setState({
    sessions: [
      {
        name: 'zen_dev',
        displayName: 'dev',
        cwd: '/home/dev',
        created: 0,
        windows: [
          { index: 0, name: 'editor', active: true, zoomed: false, paneCount: 1, cwd: '/home/dev' },
        ],
      },
    ],
  } as any);
  useUiStore.setState({ toasts: [] } as any);
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TerminalPane header integration', () => {
  it('renders displayName instead of raw sessionId when sessions store has the entry', () => {
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="dev"
        windowIndex={0}
        paneIndex={0}
        isFocused
        isVisible
      />,
    );
    expect(screen.getByText('dev')).toBeInTheDocument();
    expect(screen.getByText('editor')).toBeInTheDocument();
    expect(screen.getByText(/\[w0\]/)).toBeInTheDocument();
  });

  it('Copy ID button writes sessionId to navigator.clipboard and pushes a success toast', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, writable: true, value: { writeText, readText: async () => '' },
    });
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="dev"
        windowIndex={0}
        paneIndex={0}
        isFocused
        isVisible
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy session id/i }));
    });
    expect(writeText).toHaveBeenCalledWith("dev");
    await waitFor(() => {
      const toasts = (useUiStore.getState() as any).toasts as Array<{ message: string; type: string }>;
      expect(toasts.some((tt) => /copied/i.test(tt.message))).toBe(true);
    });
  });

  it('Zoom + button increases font size in settings store', () => {
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="dev"
        windowIndex={0}
        paneIndex={0}
        isFocused
        isVisible
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /increase font size/i }));
    expect(useSettingsStore.getState().fontSize).toBe(15);
  });
});
