import React from 'react';
import { act, create } from 'react-test-renderer';
import { Linking } from 'react-native';

import { resolveTheme } from '@/src/theme';

const mockTheme = resolveTheme('light', 'light');
const mockRequestPermission = jest.fn();
let mockPermission: { granted: boolean; canAskAgain: boolean } | null = {
  granted: false,
  canAskAgain: true,
};

jest.mock('@/src/theme', () => ({
  ...jest.requireActual('@/src/theme'),
  useTheme: () => mockTheme,
}));

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    CameraView: (props: any) => React.createElement(View, { ...props, testID: 'camera-view' }),
    useCameraPermissions: () => [mockPermission, mockRequestPermission],
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, { testID: 'safe-area-provider' }, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: ({ children, visible, ...props }: any) =>
      visible ? React.createElement(View, { ...props, testID: 'mock-modal' }, children) : null,
  };
});

function collectTexts(root: ReturnType<typeof create>['root']): string[] {
  const texts: string[] = [];

  const traverse = (node: ReturnType<typeof create>['root']) => {
    if ((node.type as string) === 'Text') {
      node.children.forEach((child) => {
        if (typeof child === 'string') {
          texts.push(child);
        }
      });
    }

    node.children.forEach((child) => {
      if (typeof child !== 'string') {
        traverse(child);
      }
    });
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
const QrScannerModal = require('../QrScannerModal').QrScannerModal as (props: {
  visible: boolean;
  onClose: () => void;
  onManualEntry?: () => void;
  onScan: (result: { url: string; token: string }) => void;
}) => React.JSX.Element;

describe('QrScannerModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermission = { granted: false, canAskAgain: true };
  });

  it('opens system settings when camera permission is locked', async () => {
    mockPermission = { granted: false, canAskAgain: false };
    const openSettingsSpy = jest.spyOn(Linking, 'openSettings').mockResolvedValue();

    let root: ReturnType<typeof create>;
    await act(async () => {
      root = create(React.createElement(QrScannerModal, {
        visible: true,
        onClose: jest.fn(),
        onScan: jest.fn(),
      }));
    });

    await act(async () => {
      findTouchableByText(root!.root, 'Open Settings').props.onPress();
    });

    expect(openSettingsSpy).toHaveBeenCalled();
    openSettingsSpy.mockRestore();
  });

  it('returns to manual entry from the scanner view', async () => {
    mockPermission = { granted: true, canAskAgain: true };
    const onClose = jest.fn();
    const onManualEntry = jest.fn();

    let root: ReturnType<typeof create>;
    await act(async () => {
      root = create(React.createElement(QrScannerModal, {
        visible: true,
        onClose,
        onManualEntry,
        onScan: jest.fn(),
      }));
    });

    await act(async () => {
      findTouchableByText(root!.root, 'Enter Manually').props.onPress();
    });

    expect(onClose).toHaveBeenCalled();
    expect(onManualEntry).toHaveBeenCalled();
  });

  it('shows an actionable error when the QR code is invalid', async () => {
    mockPermission = { granted: true, canAskAgain: true };

    let root: ReturnType<typeof create>;
    await act(async () => {
      root = create(React.createElement(QrScannerModal, {
        visible: true,
        onClose: jest.fn(),
        onManualEntry: jest.fn(),
        onScan: jest.fn(),
      }));
    });

    await act(async () => {
      root!.root.findByProps({ testID: 'camera-view' }).props.onBarcodeScanned({ data: 'invalid-qr' });
    });

    const texts = collectTexts(root!.root);
    expect(texts).toContain('Scan Failed');
    expect(texts.some((text) => text.includes('Not a ZenTerm QR code'))).toBe(true);
    expect(texts).toContain('Scan Again');
  });
});
