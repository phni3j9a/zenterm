import React from 'react';
import { act, create } from 'react-test-renderer';

import { resolveTheme } from '@/src/theme';
import type { Server } from '@/src/types';

const mockTheme = resolveTheme('light', 'light');

jest.mock('@/src/theme', () => ({
  ...jest.requireActual('@/src/theme'),
  useTheme: () => mockTheme,
}));

const mockVerifyAuth = jest.fn();

jest.mock('@/src/api/client', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

let mockServers: Server[] = [];
const mockAddServer = jest.fn();
const mockUpdateServer = jest.fn();
const mockRemoveServer = jest.fn();

jest.mock('@/src/stores/servers', () => ({
  useServersStore: (selector: (state: unknown) => unknown) =>
    selector({
      servers: mockServers,
      addServer: mockAddServer,
      updateServer: mockUpdateServer,
      removeServer: mockRemoveServer,
    }),
}));

jest.mock('expo-router', () => {
  const MockReact = require('react');
  return {
    Stack: {
      Screen: ({ children }: { children?: React.ReactNode }) =>
        MockReact.createElement('View', { testID: 'stack-screen' }, children),
    },
  };
});

function collectTexts(root: ReturnType<typeof create>['root']): string[] {
  const texts: string[] = [];
  const traverse = (node: ReturnType<typeof create>['root']) => {
    if ((node.type as string) === 'Text') {
      for (const child of node.children) {
        if (typeof child === 'string') {
          texts.push(child);
        }
      }
    }

    for (const child of node.children) {
      if (typeof child !== 'string') {
        traverse(child);
      }
    }
  };

  traverse(root);

  return texts;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ServersScreen = require('../servers').default as () => React.JSX.Element;

const defaultServer: Server = {
  id: 'srv-1',
  name: 'Raspberry Pi 5',
  url: 'http://raspi.local:3000',
  token: 'token-1',
  isDefault: true,
};

const extraServer: Server = {
  id: 'srv-2',
  name: 'Backup Pi',
  url: 'http://backup.local:3000',
  token: 'token-2',
  isDefault: false,
};

describe('ServersScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockServers = [defaultServer, extraServer];
  });

  it('renders the add prompt without the removed hero card copy', async () => {
    let root: ReturnType<typeof create>;

    await act(async () => {
      root = create(React.createElement(ServersScreen));
    });

    const texts = collectTexts(root!.root);

    expect(texts).toContain('新しい接続先を登録');
    expect(texts.some((text) => text.includes('必要なときにすぐ切り替えられる状態にします'))).toBe(true);
    expect(texts).toContain('DEFAULT');
    expect(texts).not.toContain('接続先を素早く切り替える');
    expect(texts).not.toContain('2 SAVED');
    expect(texts).not.toContain('STATE');
  });

  it('shows the empty state while keeping the add prompt header', async () => {
    mockServers = [];
    let root: ReturnType<typeof create>;

    await act(async () => {
      root = create(React.createElement(ServersScreen));
    });

    const texts = collectTexts(root!.root);

    expect(texts).toContain('サーバーがありません');
    expect(texts).toContain('新しい接続先を登録');
    expect(texts).not.toContain('接続先を素早く切り替える');
  });
});
