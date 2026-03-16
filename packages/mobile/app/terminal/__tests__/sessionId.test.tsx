import React from 'react';
import { create, act, type ReactTestRenderer } from 'react-test-renderer';

import { resolveTheme } from '@/src/theme';

// Must use 'mock' prefix to be accessible inside jest.mock factory
const mockDarkTheme = resolveTheme('dark', 'dark');
const mockLightTheme = resolveTheme('light', 'light');
let mockCurrentTheme = mockDarkTheme;

jest.mock('@/src/theme', () => ({
  ...jest.requireActual('@/src/theme'),
  useTheme: () => mockCurrentTheme,
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ sessionId: 'test-session' }),
  useRouter: () => ({ back: mockBack }),
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('react-native-safe-area-context', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) =>
      MockReact.createElement(RN.View, { ...props, testID: 'safe-area' }, children),
  };
});

jest.mock('react-native-webview', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    WebView: MockReact.forwardRef((props: any, ref: any) => {
      MockReact.useImperativeHandle(ref, () => ({
        injectJavaScript: jest.fn(),
      }));
      return MockReact.createElement(RN.View, { ...props, testID: 'mock-webview' });
    }),
  };
});

jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(() => Promise.resolve('')),
}));

const mockGetDefaultServer = jest.fn();
jest.mock('@/src/stores/servers', () => ({
  useServersStore: (selector: (s: any) => any) =>
    selector({ getDefaultServer: mockGetDefaultServer }),
}));

jest.mock('@/src/stores/settings', () => ({
  useSettingsStore: (selector: (s: any) => any) =>
    selector({ settings: { fontSize: 14, themeMode: 'dark' as const } }),
}));

import TerminalScreen from '../[sessionId]';

const mockServer = {
  id: 'server-1',
  name: 'Test Server',
  url: 'http://localhost:8765',
  token: 'test-token',
  isDefault: true,
};

describe('TerminalScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockGetDefaultServer.mockReset();
    mockCurrentTheme = mockDarkTheme;
  });

  describe('with server', () => {
    beforeEach(() => {
      mockGetDefaultServer.mockReturnValue(mockServer);
    });

    it('renders without crashing', () => {
      let tree: ReactTestRenderer | undefined;
      act(() => {
        tree = create(<TerminalScreen />);
      });
      expect(tree?.toJSON()).toBeTruthy();
    });

    it('renders custom header bar with session name', () => {
      let tree: ReactTestRenderer | undefined;
      act(() => {
        tree = create(<TerminalScreen />);
      });
      const json = JSON.stringify(tree?.toJSON());
      expect(json).toContain('test-session');
    });

    it('renders close button', () => {
      let tree: ReactTestRenderer | undefined;
      act(() => {
        tree = create(<TerminalScreen />);
      });
      const json = JSON.stringify(tree?.toJSON());
      expect(json).toContain('close');
    });

    it('renders status pill with disconnected state initially', () => {
      let tree: ReactTestRenderer | undefined;
      act(() => {
        tree = create(<TerminalScreen />);
      });
      const json = JSON.stringify(tree?.toJSON());
      expect(json).toContain('\u672A\u63A5\u7D9A');
    });

    it('calls router.back when close button is pressed', () => {
      let tree: ReactTestRenderer | undefined;
      act(() => {
        tree = create(<TerminalScreen />);
      });
      const root = tree!.root;
      const pressables = root.findAllByProps({ hitSlop: 12 });
      expect(pressables.length).toBeGreaterThan(0);
      act(() => {
        pressables[0].props.onPress();
      });
      expect(mockBack).toHaveBeenCalled();
    });

    it('renders TerminalWebView', () => {
      let tree: ReactTestRenderer | undefined;
      act(() => {
        tree = create(<TerminalScreen />);
      });
      const root = tree!.root;
      const webviews = root.findAllByProps({ testID: 'mock-webview' });
      expect(webviews.length).toBeGreaterThanOrEqual(1);
    });

    it('renders SpecialKeys', () => {
      let tree: ReactTestRenderer | undefined;
      act(() => {
        tree = create(<TerminalScreen />);
      });
      const json = JSON.stringify(tree?.toJSON());
      expect(json).toContain('Esc');
      expect(json).toContain('Tab');
      expect(json).toContain('Ctrl');
    });
  });

  describe('without server', () => {
    beforeEach(() => {
      mockGetDefaultServer.mockReturnValue(null);
    });

    it('renders no-server message', () => {
      let tree: ReactTestRenderer | undefined;
      act(() => {
        tree = create(<TerminalScreen />);
      });
      const json = JSON.stringify(tree?.toJSON());
      expect(json).toContain('\u30C7\u30D5\u30A9\u30EB\u30C8\u30B5\u30FC\u30D0\u30FC\u304C\u3042\u308A\u307E\u305B\u3093');
    });

    it('still renders close button in header', () => {
      let tree: ReactTestRenderer | undefined;
      act(() => {
        tree = create(<TerminalScreen />);
      });
      const json = JSON.stringify(tree?.toJSON());
      expect(json).toContain('close');
    });

    it('close button works even without server', () => {
      let tree: ReactTestRenderer | undefined;
      act(() => {
        tree = create(<TerminalScreen />);
      });
      const root = tree!.root;
      const pressables = root.findAllByProps({ hitSlop: 12 });
      expect(pressables.length).toBeGreaterThan(0);
      act(() => {
        pressables[0].props.onPress();
      });
      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe('theme integration', () => {
    it('renders with dark theme', () => {
      mockCurrentTheme = mockDarkTheme;
      mockGetDefaultServer.mockReturnValue(mockServer);
      let tree: ReactTestRenderer | undefined;
      act(() => {
        tree = create(<TerminalScreen />);
      });
      expect(tree?.toJSON()).toBeTruthy();
    });

    it('renders with light theme', () => {
      mockCurrentTheme = mockLightTheme;
      mockGetDefaultServer.mockReturnValue(mockServer);
      let tree: ReactTestRenderer | undefined;
      act(() => {
        tree = create(<TerminalScreen />);
      });
      expect(tree?.toJSON()).toBeTruthy();
    });
  });
});
