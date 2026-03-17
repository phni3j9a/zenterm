import React from 'react';
import { create, act, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';

import { SystemStatus } from '../components/SystemStatus';
import { AppThemeProvider } from '../theme/ThemeProvider';
import type { Server, SystemStatus as SystemStatusType } from '../types';

// Mock the API client
const mockGetSystemStatus = jest.fn();
jest.mock('../api/client', () => ({
  getSystemStatus: (...args: unknown[]) => mockGetSystemStatus(...args),
}));

const mockServer: Server = {
  id: 'test-1',
  name: 'Test Server',
  url: 'http://localhost:3000',
  token: 'test-token',
  isDefault: true,
};

const mockStatus: SystemStatusType = {
  cpu: { usage: 42, cores: 4, model: 'ARM Cortex-A76', loadAvg: [0.5, 0.3, 0.2] },
  memory: { total: 8 * 1024 * 1024 * 1024, used: 4 * 1024 * 1024 * 1024, free: 4 * 1024 * 1024 * 1024, percent: 50 },
  disk: { total: 200 * 1024 * 1024 * 1024, used: 100 * 1024 * 1024 * 1024, free: 100 * 1024 * 1024 * 1024, percent: 50 },
  temperature: 45,
  uptime: 86400 + 3600,
};

/** Recursively collect all text content from the tree */
function collectAllText(instance: ReactTestInstance): string[] {
  const texts: string[] = [];
  for (const child of instance.children) {
    if (typeof child === 'string') {
      texts.push(child);
    } else {
      texts.push(...collectAllText(child));
    }
  }
  return texts;
}

describe('SystemStatus', () => {
  let renderer: ReactTestRenderer;

  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
    mockGetSystemStatus.mockReset();
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer.unmount();
      });
    }
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders skeleton loaders while initial loading', async () => {
    mockGetSystemStatus.mockReturnValue(new Promise(() => {}));

    await act(async () => {
      renderer = create(
        <AppThemeProvider>
          <SystemStatus server={mockServer} />
        </AppThemeProvider>,
      );
    });

    const skeletons = renderer.root.findAllByProps({ testID: 'skeleton-root' });
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it('renders status data after successful fetch', async () => {
    mockGetSystemStatus.mockResolvedValue(mockStatus);

    await act(async () => {
      renderer = create(
        <AppThemeProvider>
          <SystemStatus server={mockServer} />
        </AppThemeProvider>,
      );
    });

    // Flush async effects
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
    }

    const texts = collectAllText(renderer.root);

    expect(texts.some((t) => t.includes('System Status'))).toBe(true);
    expect(texts.some((t) => t.includes('42'))).toBe(true);
    // "4 cores" may be rendered as separate children ("4" and " cores") by RN
    expect(texts.some((t) => t.includes('cores'))).toBe(true);
  });

  it('renders error message when fetch fails', async () => {
    mockGetSystemStatus.mockRejectedValue(new Error('Connection failed'));

    await act(async () => {
      renderer = create(
        <AppThemeProvider>
          <SystemStatus server={mockServer} />
        </AppThemeProvider>,
      );
    });

    for (let i = 0; i < 5; i++) {
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
    }

    const texts = collectAllText(renderer.root);
    expect(texts.some((t) => t.includes('System Status'))).toBe(true);
    expect(texts.some((t) => t.includes('Connection failed'))).toBe(true);
  });
});
