import React from 'react';
import { create, act } from 'react-test-renderer';

import { resolveTheme } from '@/src/theme';
import type { TmuxSession } from '@/src/types';

/* ---------- theme mock ---------- */

const mockTheme = resolveTheme('light', 'light');

jest.mock('@/src/theme', () => {
  const actual = jest.requireActual('@/src/theme');
  return {
    ...actual,
    useTheme: () => mockTheme,
  };
});

/* ---------- mocks ---------- */

const mockListSessions = jest.fn<Promise<TmuxSession[]>, []>();
const mockCreateSession = jest.fn();
const mockDeleteSession = jest.fn();
const mockRenameSession = jest.fn();

jest.mock('@/src/api/client', () => ({
  listSessions: (...args: unknown[]) => mockListSessions(...(args as [])),
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
  renameSession: (...args: unknown[]) => mockRenameSession(...args),
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
const mockGetDefaultServer = jest.fn();

jest.mock('expo-router', () => {
  const mockReact = require('react');
  return {
    Stack: {
      Screen: ({ children }: { children?: React.ReactNode }) =>
        mockReact.createElement('View', { testID: 'stack-screen' }, children),
    },
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (cb: () => void) => {
      mockReact.useEffect(() => {
        cb();
      }, [cb]);
    },
  };
});

jest.mock('react-native-webview', () => {
  const mockReact = require('react');
  const RN = require('react-native');
  return {
    WebView: mockReact.forwardRef((props: any, ref: any) => {
      mockReact.useImperativeHandle(ref, () => ({
        injectJavaScript: jest.fn(),
      }));
      return mockReact.createElement(RN.View, { ...props, testID: 'mock-webview' });
    }),
  };
});

jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(() => Promise.resolve('')),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('@/src/stores/settings', () => ({
  useSettingsStore: (selector: (s: any) => any) =>
    selector({ settings: { fontSize: 14, themeMode: 'dark' as const } }),
}));

jest.mock('@/src/stores/servers', () => ({
  useServersStore: Object.assign(
    (selector: (state: { getDefaultServer: () => unknown }) => unknown) =>
      selector({ getDefaultServer: () => mockGetDefaultServer() }),
    { getState: () => ({ getDefaultServer: () => mockGetDefaultServer() }) },
  ),
}));

/* ---------- helpers ---------- */

const mockServer = {
  id: 'srv-1',
  name: 'Test Server',
  url: 'http://localhost:3000',
  token: 'test-token',
  isDefault: true,
};

const sampleSessions: TmuxSession[] = [
  {
    name: 'psh_work',
    displayName: 'work',
    created: 1710576600,
    cwd: '/home/user/projects/myapp',
  },
  {
    name: 'psh_deploy',
    displayName: 'deploy',
    created: 1710580200,
    cwd: '/home/user/projects/deploy',
  },
];

function findAllByTestID(root: ReturnType<typeof create>['root'], testID: string) {
  return root.findAll((node) => node.props.testID === testID);
}

function collectTexts(root: ReturnType<typeof create>['root']): string[] {
  const texts: string[] = [];
  const traverse = (node: ReturnType<typeof create>['root']) => {
    if ((node.type as string) === 'Text' && node.children) {
      for (const child of node.children) {
        if (typeof child === 'string') {
          texts.push(child);
        }
      }
    }
    if (node.children) {
      for (const child of node.children) {
        if (typeof child !== 'string') {
          traverse(child);
        }
      }
    }
  };
  traverse(root);
  return texts;
}

/* ---------- component import ---------- */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SessionsScreen = require('../sessions').default as () => React.JSX.Element;

/* ---------- tests ---------- */

describe('SessionsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListSessions.mockResolvedValue([]);
    mockGetDefaultServer.mockReturnValue(mockServer);
  });

  describe('Header', () => {
    it('renders the create prompt without the removed hero or system status', async () => {
      mockListSessions.mockResolvedValue(sampleSessions);

      let root: ReturnType<typeof create>;
      await act(async () => {
        root = create(React.createElement(SessionsScreen));
      });

      const texts = collectTexts(root!.root);
      const systemStatus = findAllByTestID(root!.root, 'system-status');

      expect(texts).toContain('新しいセッションを作成');
      expect(texts.some((text) => text.includes('ターミナルを開いて作業を始めましょう'))).toBe(true);
      expect(texts).not.toContain('あなたのワークスペースをすべてここから');
      expect(texts.some((text) => text.includes('tmux セッションの確認'))).toBe(false);
      expect(systemStatus).toHaveLength(0);
    });
  });

  describe('Session list', () => {
    it('renders session cards with name, cwd, date, and status pill', async () => {
      mockListSessions.mockResolvedValue(sampleSessions);

      let root: ReturnType<typeof create>;
      await act(async () => {
        root = create(React.createElement(SessionsScreen));
      });

      const texts = collectTexts(root!.root);

      expect(texts).toContain('work');
      expect(texts).toContain('deploy');
      expect(texts).toContain('/home/user/projects/myapp');
      expect(texts).toContain('/home/user/projects/deploy');
      expect(texts.filter((t) => t === 'active').length).toBe(2);
      expect(texts.filter((t) => t === 'タップで接続').length).toBe(2);
      expect(texts.filter((t) => t === 'スワイプで操作').length).toBe(2);

      const icons = findAllByTestID(root!.root, 'mock-ionicon');
      const iconNames = icons.map((i) => i.children?.[0]);
      expect(iconNames.filter((n) => n === 'folder-outline').length).toBe(2);
    });
  });

  describe('Empty state', () => {
    it('shows EmptyState when no sessions and no error', async () => {
      mockListSessions.mockResolvedValue([]);

      let root: ReturnType<typeof create>;
      await act(async () => {
        root = create(React.createElement(SessionsScreen));
      });

      const emptyStates = findAllByTestID(root!.root, 'empty-state-root');
      expect(emptyStates.length).toBeGreaterThanOrEqual(1);

      const texts = collectTexts(root!.root);
      expect(texts).toContain('セッションがありません');
      expect(texts).toContain('新しい tmux セッションを作成して開始しましょう');
    });

    it('shows error EmptyState when loading fails', async () => {
      mockListSessions.mockRejectedValue(new Error('Network error'));

      let root: ReturnType<typeof create>;
      await act(async () => {
        root = create(React.createElement(SessionsScreen));
      });

      const texts = collectTexts(root!.root);
      expect(texts).toContain('セッションを取得できません');
      expect(texts).toContain('再試行');
    });
  });

  describe('No server configured', () => {
    it('shows server setup EmptyState when no default server', async () => {
      mockGetDefaultServer.mockReturnValue(null);

      let root: ReturnType<typeof create>;
      await act(async () => {
        root = create(React.createElement(SessionsScreen));
      });

      const texts = collectTexts(root!.root);
      expect(texts).toContain('はじめましょう');
      expect(texts).not.toContain('新しいセッションを作成');
    });
  });

  describe('Create prompt card', () => {
    it('renders create prompt card when form is not shown', async () => {
      mockListSessions.mockResolvedValue(sampleSessions);

      let root: ReturnType<typeof create>;
      await act(async () => {
        root = create(React.createElement(SessionsScreen));
      });

      const texts = collectTexts(root!.root);
      expect(texts).toContain('新しいセッションを作成');
      expect(texts.some((t) => t.includes('ターミナルを開いて作業を始めましょう'))).toBe(true);

      const icons = findAllByTestID(root!.root, 'mock-ionicon');
      const iconNames = icons.map((i) => i.children?.[0]);
      expect(iconNames).toContain('add-outline');
    });
  });
});
