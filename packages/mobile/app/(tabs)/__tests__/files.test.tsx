import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import Toast from 'react-native-toast-message';

import { resolveTheme } from '@/src/theme';
import type { FileEntry, Server } from '@/src/types';

const mockTheme = resolveTheme('light', 'light');
const mockNavigation = {
  addListener: jest.fn(),
  isFocused: jest.fn(),
};
const mockGetDefaultServer = jest.fn<Server | null, []>();
const mockGetDocumentAsync = jest.fn();
const mockDownloadAsync = jest.fn();
const mockShareAsync = jest.fn();
const mockGetFileContent = jest.fn();
const mockGetFileRawUrl = jest.fn();
const mockListFiles = jest.fn();
const mockUploadFileToPath = jest.fn();
const mockWriteFileContent = jest.fn();
const renderedTrees: ReactTestRenderer[] = [];

jest.mock('@/src/theme', () => ({
  ...jest.requireActual('@/src/theme'),
  useTheme: () => mockTheme,
}));

jest.mock('@/src/stores/servers', () => ({
  useServersStore: (selector: (state: unknown) => unknown) =>
    selector({
      getDefaultServer: () => mockGetDefaultServer(),
    }),
}));

jest.mock('@/src/api/client', () => ({
  getFileContent: (...args: unknown[]) => mockGetFileContent(...args),
  getFileRawUrl: (...args: unknown[]) => mockGetFileRawUrl(...args),
  listFiles: (...args: unknown[]) => mockListFiles(...args),
  uploadFileToPath: (...args: unknown[]) => mockUploadFileToPath(...args),
  writeFileContent: (...args: unknown[]) => mockWriteFileContent(...args),
}));

jest.mock('expo-document-picker', () => ({
  __esModule: true,
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

jest.mock('expo-file-system/legacy', () => ({
  __esModule: true,
  cacheDirectory: 'file:///cache/',
  downloadAsync: (...args: unknown[]) => mockDownloadAsync(...args),
}));

jest.mock('expo-sharing', () => ({
  __esModule: true,
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

jest.mock('expo-router', () => {
  const MockReact = require('react');
  const { View } = require('react-native');

  return {
    Stack: {
      Screen: ({ options }: { options?: { headerRight?: () => React.ReactNode } }) =>
        MockReact.createElement(View, { testID: 'stack-screen' }, options?.headerRight?.()),
    },
    useNavigation: () => mockNavigation,
  };
});

jest.mock('react-native-markdown-display', () => {
  const MockReact = require('react');
  const { Text } = require('react-native');

  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) =>
      MockReact.createElement(Text, { testID: 'mock-markdown' }, children),
  };
});

jest.mock('@/src/components/SetupGuide', () => {
  const MockReact = require('react');
  const { View } = require('react-native');

  return {
    SetupGuide: () => MockReact.createElement(View, { testID: 'setup-guide' }),
  };
});

jest.mock('@/src/components/ui', () => {
  const MockReact = require('react');
  const { Text, View } = require('react-native');

  return {
    EmptyState: ({ title }: { title: string }) =>
      MockReact.createElement(View, { testID: 'empty-state' }, MockReact.createElement(Text, null, title)),
    SkeletonLoader: () => MockReact.createElement(View, { testID: 'skeleton-loader' }),
  };
});

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const MockReact = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: ({ children, visible, ...props }: any) =>
      visible ? MockReact.createElement(View, { ...props, testID: 'mock-modal' }, children) : null,
  };
});

jest.mock('react-native/Libraries/Image/Image', () => {
  const MockReact = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: (props: any) => MockReact.createElement(View, { ...props, testID: 'mock-image' }),
  };
});

const FilesScreen = require('../files').default as () => React.JSX.Element;

const mockServer: Server = {
  id: 'srv-1',
  name: 'Raspberry Pi 5',
  url: 'http://raspi.local:3000',
  token: 'token-1',
  isDefault: true,
};

function makeEntry(name: string, type: FileEntry['type'] = 'file'): FileEntry {
  return {
    name,
    type,
    size: 100,
    modified: 1_000,
    permissions: '-rw-r--r--',
  };
}

function findTouchablesByText(root: ReactTestInstance, label: string): ReactTestInstance[] {
  const textNodes = root.findAll((node) => {
    if (String(node.type) !== 'Text') return false;
    return node.children.some((child) => typeof child === 'string' && child === label);
  });

  return textNodes.flatMap((textNode) => {
    let node: ReactTestInstance | null = textNode.parent;
    while (node) {
      if (node.props.onPress) return [node];
      node = node.parent;
    }
    return [];
  });
}

function findTouchableByText(root: ReactTestInstance, label: string): ReactTestInstance {
  const [touchable] = findTouchablesByText(root, label);
  if (!touchable) {
    throw new Error(`Touchable not found for label: ${label}`);
  }
  return touchable;
}

function flushTasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function press(node: ReactTestInstance): Promise<void> {
  await act(async () => {
    node.props.onPress();
    await flushTasks();
    await flushTasks();
  });
}

async function renderScreen(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(React.createElement(FilesScreen));
  });
  await act(async () => {
    await flushTasks();
    await flushTasks();
  });
  renderedTrees.push(tree);
  return tree;
}

describe('FilesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDefaultServer.mockReturnValue(mockServer);
    mockNavigation.addListener.mockReturnValue(jest.fn());
    mockNavigation.isFocused.mockReturnValue(false);
    mockListFiles.mockResolvedValue({ path: '~', entries: [] });
    mockGetFileContent.mockResolvedValue({
      path: '/docs/note.txt',
      content: 'hello',
      lines: 1,
      truncated: false,
    });
    mockGetFileRawUrl.mockImplementation((_server: Server, path: string) => `https://raw.example${path}`);
    mockUploadFileToPath.mockResolvedValue({
      success: true,
      path: '/uploads/report.pdf',
      filename: 'report.pdf',
      size: 123,
      mimetype: 'application/pdf',
    });
    mockWriteFileContent.mockResolvedValue({ path: '/docs/note.txt', bytes: 5 });
    mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
    mockDownloadAsync.mockResolvedValue({ uri: 'file:///cache/shared-file' });
    mockShareAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => {
      while (renderedTrees.length > 0) {
        renderedTrees.pop()?.unmount();
      }
    });
  });

  it('opens image preview and shares the downloaded image', async () => {
    mockListFiles.mockResolvedValue({
      path: '/images',
      entries: [makeEntry('photo.png')],
    });
    mockDownloadAsync.mockResolvedValue({ uri: 'file:///cache/photo.png' });

    const tree = await renderScreen();

    await press(findTouchableByText(tree.root, 'photo.png'));

    const image = tree.root.findByProps({ testID: 'mock-image' });
    expect(image.props.source).toEqual({
      uri: 'https://raw.example/images/photo.png',
      headers: { Authorization: 'Bearer token-1' },
    });

    await press(findTouchableByText(tree.root, 'share-outline'));

    expect(mockDownloadAsync).toHaveBeenCalledWith(
      'https://raw.example/images/photo.png',
      'file:///cache/photo.png',
      { headers: { Authorization: 'Bearer token-1' } },
    );
    expect(mockShareAsync).toHaveBeenCalledWith('file:///cache/photo.png');
  });

  it('uploads a picked file to the current directory and reloads the list', async () => {
    mockListFiles.mockResolvedValue({ path: '/uploads', entries: [] });
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///picked/report.pdf',
          name: 'report.pdf',
          mimeType: 'application/pdf',
          lastModified: 1,
        },
      ],
    });

    const tree = await renderScreen();

    await press(findTouchableByText(tree.root, 'cloud-upload-outline'));

    expect(mockGetDocumentAsync).toHaveBeenCalledWith({ copyToCacheDirectory: true });
    expect(mockUploadFileToPath).toHaveBeenCalledWith(
      mockServer,
      'file:///picked/report.pdf',
      'report.pdf',
      'application/pdf',
      '/uploads',
    );
    expect(mockListFiles).toHaveBeenCalledTimes(2);
    expect(mockListFiles).toHaveBeenLastCalledWith(mockServer, '/uploads', false);
    expect(Toast.show).toHaveBeenCalledWith({
      type: 'success',
      text1: 'アップロード完了',
      text2: 'report.pdf',
    });
  });

  it('shares the currently previewed text file', async () => {
    mockListFiles.mockResolvedValue({
      path: '/docs',
      entries: [makeEntry('note.txt')],
    });
    mockGetFileContent.mockResolvedValue({
      path: '/docs/note.txt',
      content: 'hello',
      lines: 1,
      truncated: false,
    });
    mockDownloadAsync.mockResolvedValue({ uri: 'file:///cache/note.txt' });

    const tree = await renderScreen();

    await press(findTouchableByText(tree.root, 'note.txt'));
    await press(findTouchableByText(tree.root, 'share-outline'));

    expect(mockGetFileContent).toHaveBeenCalledWith(mockServer, '/docs/note.txt');
    expect(mockDownloadAsync).toHaveBeenCalledWith(
      'https://raw.example/docs/note.txt',
      'file:///cache/note.txt',
      { headers: { Authorization: 'Bearer token-1' } },
    );
    expect(mockShareAsync).toHaveBeenCalledWith('file:///cache/note.txt');
  });
});
