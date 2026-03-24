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

jest.mock('@/src/components/QrScannerModal', () => {
  const MockReact = require('react');
  const RN = require('react-native');

  return {
    QrScannerModal: ({ visible }: { visible: boolean }) =>
      visible ? MockReact.createElement(RN.View, { testID: 'qr-scanner-modal' }) : null,
  };
});

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
    useRouter: () => ({ back: jest.fn() }),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) =>
      MockReact.createElement(RN.View, { ...props, testID: 'safe-area' }, children),
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

function findTouchableByText(root: ReturnType<typeof create>['root'], label: string) {
  const textNode = root.find(
    (node) => (node.type as string) === 'Text' && node.children.some((child) => typeof child === 'string' && child === label),
  );

  let current: typeof textNode | null = textNode;
  while (current) {
    if (current.props.onPress) {
      return current;
    }
    current = current.parent;
  }

  throw new Error(`Touchable not found for label: ${label}`);
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

    expect(texts).toContain('Add Connection');
    expect(texts.some((text) => text.includes('so you can switch connections anytime'))).toBe(true);
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

    expect(texts).toContain('No Servers');
    expect(texts).toContain('Add Connection');
    expect(texts).not.toContain('接続先を素早く切り替える');
  });

  it('renders visible quick actions for each server row', async () => {
    let root: ReturnType<typeof create>;

    await act(async () => {
      root = create(React.createElement(ServersScreen));
    });

    const texts = collectTexts(root!.root);
    expect(texts).toContain('Edit');
    expect(texts).toContain('Delete');
    expect(texts).toContain('Set Default');
  });

  it('sets a standby server as default from the visible action button', async () => {
    let root: ReturnType<typeof create>;

    await act(async () => {
      root = create(React.createElement(ServersScreen));
    });

    await act(async () => {
      findTouchableByText(root!.root, 'Set Default').props.onPress();
    });

    expect(mockUpdateServer).toHaveBeenCalledWith('srv-2', { isDefault: true });
  });
});
