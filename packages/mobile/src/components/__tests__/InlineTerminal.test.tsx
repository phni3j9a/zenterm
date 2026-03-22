import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { resolveTheme } from '@/src/theme';

const mockTheme = resolveTheme('dark', 'dark');
const mockSendInput = jest.fn();

type KeyPressOptions = {
  noFocus?: boolean;
};

type KeyPressHandler = (data: string, options?: KeyPressOptions) => void;

type TerminalStatus = 'connected' | 'disconnected' | 'error' | 'reconnecting';

type MockSpecialKeysProps = {
  onKeyPress: KeyPressHandler;
  server?: unknown;
};

type MockTerminalWebViewProps = {
  server: unknown;
  sessionId: string;
  onStatusChange?: (status: TerminalStatus) => void;
};

let mockSpecialKeysProps: MockSpecialKeysProps | undefined;

jest.mock('@/src/theme', () => ({
  ...jest.requireActual('@/src/theme'),
  useTheme: () => mockTheme,
}));

jest.mock('../TerminalWebView', () => {
  const MockReact = require('react');
  const RN = require('react-native');

  return {
    TerminalWebView: MockReact.forwardRef(
      (props: MockTerminalWebViewProps, ref: React.ForwardedRef<{ sendInput: typeof mockSendInput }>) => {
        MockReact.useImperativeHandle(ref, () => ({
          sendInput: mockSendInput,
        }));

        return MockReact.createElement(RN.View, { ...props, testID: 'mock-terminal-webview' });
      },
    ),
  };
});

jest.mock('../SpecialKeys', () => {
  const MockReact = require('react');
  const RN = require('react-native');

  return {
    SpecialKeys: (props: MockSpecialKeysProps) => {
      mockSpecialKeysProps = props;
      return MockReact.createElement(RN.View, { testID: 'mock-special-keys' });
    },
  };
});

import { InlineTerminal } from '../InlineTerminal';

const mockServer = {
  id: 'server-1',
  name: 'Test Server',
  url: 'http://localhost:8765',
  token: 'test-token',
  isDefault: true,
};

describe('InlineTerminal', () => {
  beforeEach(() => {
    mockSendInput.mockClear();
    mockSpecialKeysProps = undefined;
  });

  it('renders terminal and special keys', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<InlineTerminal server={mockServer} sessionId="session-1" />);
    });
    const root = tree!.root;
    expect(root.findAllByProps({ testID: 'mock-terminal-webview' }).length).toBeGreaterThan(0);
    expect(root.findAllByProps({ testID: 'mock-special-keys' }).length).toBeGreaterThan(0);
  });

  it('passes noFocus options through to sendInput', () => {
    act(() => {
      create(<InlineTerminal server={mockServer} sessionId="session-1" />);
    });
    expect(mockSpecialKeysProps).toBeDefined();

    act(() => {
      mockSpecialKeysProps?.onKeyPress('\x1b[Z', { noFocus: true });
    });

    expect(mockSendInput).toHaveBeenCalledWith('\x1b[Z', { noFocus: true });
  });

  it('passes plain input through to sendInput', () => {
    act(() => {
      create(<InlineTerminal server={mockServer} sessionId="session-1" />);
    });
    expect(mockSpecialKeysProps).toBeDefined();

    act(() => {
      mockSpecialKeysProps?.onKeyPress('pasted-text');
    });

    expect(mockSendInput).toHaveBeenCalledWith('pasted-text', undefined);
  });
});
