import React from 'react';
import { act, create } from 'react-test-renderer';

import { resolveTheme } from '@/src/theme';
import type { Server } from '@/src/types';

const mockTheme = resolveTheme('light', 'light');

jest.mock('@/src/theme', () => ({
  ...jest.requireActual('@/src/theme'),
  useTheme: () => mockTheme,
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      name: 'ZenTerm',
      version: '1.0.0-test',
    },
  },
}));

const mockGetDefaultServer = jest.fn<Server | null, []>();
const mockClear = jest.fn();
const mockReset = jest.fn();
const mockUpdateSettings = jest.fn();

jest.mock('@/src/stores/servers', () => ({
  useServersStore: (selector: (state: unknown) => unknown) =>
    selector({
      getDefaultServer: () => mockGetDefaultServer(),
      clear: mockClear,
    }),
}));

jest.mock('@/src/stores/settings', () => ({
  useSettingsStore: (selector: (state: unknown) => unknown) =>
    selector({
      settings: {
        fontSize: 14,
        themeMode: 'dark' as const,
      },
      reset: mockReset,
      updateSettings: mockUpdateSettings,
    }),
}));

jest.mock('@/src/components/SystemStatus', () => {
  const MockReact = require('react');
  const RN = require('react-native');

  return {
    SystemStatus: ({ server }: { server: { name: string } }) =>
      MockReact.createElement(
        RN.View,
        { testID: 'system-status' },
        MockReact.createElement(RN.Text, null, `SystemStatus:${server.name}`),
      ),
  };
});

const mockPush = jest.fn();

jest.mock('expo-router', () => {
  const MockReact = require('react');
  return {
    Stack: {
      Screen: ({ children }: { children?: React.ReactNode }) =>
        MockReact.createElement('View', { testID: 'stack-screen' }, children),
    },
    useRouter: () => ({ push: mockPush }),
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

function findAllByTestID(root: ReturnType<typeof create>['root'], testID: string) {
  return root.findAll((node) => node.props.testID === testID);
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SettingsScreen = require('../settings').default as () => React.JSX.Element;

const mockServer: Server = {
  id: 'srv-1',
  name: 'Raspberry Pi 5',
  url: 'http://raspi.local:3000',
  token: 'token-1',
  isDefault: true,
};

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDefaultServer.mockReturnValue(mockServer);
  });

  it('renders SystemStatus under the default server card', async () => {
    let root: ReturnType<typeof create>;

    await act(async () => {
      root = create(React.createElement(SettingsScreen));
    });

    const texts = collectTexts(root!.root);
    const systemStatus = findAllByTestID(root!.root, 'system-status');

    expect(texts).toContain('サーバー管理');
    expect(texts).toContain('Raspberry Pi 5');
    expect(texts).toContain('http://raspi.local:3000');
    expect(texts).toContain('SystemStatus:Raspberry Pi 5');
    expect(systemStatus.length).toBeGreaterThan(0);
  });

  it('does not render SystemStatus when no default server exists', async () => {
    mockGetDefaultServer.mockReturnValue(null);
    let root: ReturnType<typeof create>;

    await act(async () => {
      root = create(React.createElement(SettingsScreen));
    });

    const texts = collectTexts(root!.root);
    const systemStatus = findAllByTestID(root!.root, 'system-status');

    expect(texts).toContain('タップしてサーバーを追加');
    expect(systemStatus).toHaveLength(0);
  });

  it('テーマ選択肢から System を除外し Light と Dark のみ表示する', async () => {
    mockGetDefaultServer.mockReturnValue(null);
    let root: ReturnType<typeof create>;

    await act(async () => {
      root = create(React.createElement(SettingsScreen));
    });

    const texts = collectTexts(root!.root);

    expect(texts).toContain('ライト');
    expect(texts).toContain('ダーク');
    expect(texts).not.toContain('System');
  });
});
