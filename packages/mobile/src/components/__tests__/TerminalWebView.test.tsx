import React, { createRef } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { resolveTheme } from '@/src/theme';

const mockTheme = resolveTheme('dark', 'dark');
const mockInjectJavaScript = jest.fn();

type SettingsState = {
  settings: {
    fontSize: number;
  };
};

jest.mock('@/src/theme', () => ({
  ...jest.requireActual('@/src/theme'),
  useTheme: () => mockTheme,
}));

jest.mock('@/src/stores/settings', () => ({
  useSettingsStore: (selector: (state: SettingsState) => unknown) =>
    selector({ settings: { fontSize: 14 } }),
}));

jest.mock('react-native-webview', () => {
  const MockReact = require('react');
  const RN = require('react-native');

  return {
    WebView: MockReact.forwardRef((props: object, ref: React.ForwardedRef<{ injectJavaScript: typeof mockInjectJavaScript }>) => {
      MockReact.useImperativeHandle(ref, () => ({
        injectJavaScript: mockInjectJavaScript,
      }));

      return MockReact.createElement(RN.View, { ...props, testID: 'mock-webview' });
    }),
  };
});

import { TerminalWebView, type TerminalWebViewHandle } from '../TerminalWebView';

const mockServer = {
  id: 'server-1',
  name: 'Test Server',
  url: 'http://localhost:8765',
  token: 'test-token',
  isDefault: true,
};

describe('TerminalWebView', () => {
  beforeEach(() => {
    mockInjectJavaScript.mockClear();
  });

  it('renders without crashing', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<TerminalWebView ref={createRef<TerminalWebViewHandle>()} server={mockServer} sessionId="session-1" />);
    });
    expect(tree?.toJSON()).toBeTruthy();
  });

  it('injects input bridge message without noFocus by default', () => {
    const ref = createRef<TerminalWebViewHandle>();
    act(() => {
      create(<TerminalWebView ref={ref} server={mockServer} sessionId="session-1" />);
    });

    act(() => {
      ref.current?.sendInput('\t');
    });

    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      `handleBridgeMessage(JSON.stringify({ type: 'input', data: ${JSON.stringify('\t')} })); true;`,
    );
  });

  it('injects input bridge message with noFocus when requested', () => {
    const ref = createRef<TerminalWebViewHandle>();
    act(() => {
      create(<TerminalWebView ref={ref} server={mockServer} sessionId="session-1" />);
    });

    act(() => {
      ref.current?.sendInput('\x1b[Z', { noFocus: true });
    });

    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      `handleBridgeMessage(JSON.stringify({ type: 'input', data: ${JSON.stringify('\x1b[Z')}, "noFocus": true })); true;`,
    );
  });
});
