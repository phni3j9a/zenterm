import React from 'react';
import { create, act, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';

import { resolveTheme } from '@/src/theme';

const mockTheme = resolveTheme('dark', 'dark');
jest.mock('@/src/theme', () => ({
  ...jest.requireActual('@/src/theme'),
  useTheme: () => mockTheme,
}));

jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(() => Promise.resolve('pasted-text')),
}));

import { SpecialKeys } from '../SpecialKeys';

/**
 * Find a pressable/touchable element by walking up from a text node
 * that contains the given label. The touchable may be either:
 * - accessible=true (TouchableOpacity rendered as View)
 * - has onPress prop directly
 */
function findTouchableByText(root: ReactTestInstance, label: string): ReactTestInstance | undefined {
  // Find all instances that could be text-like
  const allInstances = root.findAll((node) => {
    if (typeof node.type === 'string' && (node.type as string) === 'Text') {
      return node.children?.some((c) => typeof c === 'string' && c === label) ?? false;
    }
    return false;
  });

  for (const textNode of allInstances) {
    let node: ReactTestInstance | null = textNode.parent;
    while (node) {
      if (node.props.onPress) {
        return node;
      }
      node = node.parent;
    }
  }
  return undefined;
}

describe('SpecialKeys', () => {
  const mockOnKeyPress = jest.fn();

  beforeEach(() => {
    mockOnKeyPress.mockClear();
  });

  it('renders without crashing', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    expect(tree?.toJSON()).toBeTruthy();
  });

  it('renders Esc, Tab, Ctrl buttons', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const json = JSON.stringify(tree?.toJSON());
    expect(json).toContain('Esc');
    expect(json).toContain('Tab');
    expect(json).toContain('S-Tab');
    expect(json).toContain('Ctrl');
  });

  it('renders arrow keys', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const json = JSON.stringify(tree?.toJSON());
    expect(json).toContain('\u2190');
    expect(json).toContain('\u2191');
    expect(json).toContain('\u2193');
    expect(json).toContain('\u2192');
  });

  it('renders Paste button with clipboard icon', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const json = JSON.stringify(tree?.toJSON());
    expect(json).toContain('Paste');
    expect(json).toContain('clipboard-outline');
  });

  it('calls onKeyPress with ESC code when Esc is pressed', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const escButton = findTouchableByText(tree!.root, 'Esc');
    expect(escButton).toBeTruthy();
    act(() => {
      escButton!.props.onPress();
    });
    expect(mockOnKeyPress).toHaveBeenCalledWith('\x1b', { noFocus: true });
  });

  it('calls onKeyPress with TAB code when Tab is pressed', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const tabButton = findTouchableByText(tree!.root, 'Tab');
    expect(tabButton).toBeTruthy();
    act(() => {
      tabButton!.props.onPress();
    });
    expect(mockOnKeyPress).toHaveBeenCalledWith('\t', { noFocus: true });
  });

  it('calls onKeyPress with Shift-Tab escape sequence when S-Tab is pressed', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const sTabButton = findTouchableByText(tree!.root, 'S-Tab');
    expect(sTabButton).toBeTruthy();
    act(() => {
      sTabButton!.props.onPress();
    });
    expect(mockOnKeyPress).toHaveBeenCalledWith('\x1b[Z', { noFocus: true });
  });

  it('calls onKeyPress without noFocus when Paste is pressed', async () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const pasteButton = findTouchableByText(tree!.root, 'Paste');
    expect(pasteButton).toBeTruthy();
    await act(async () => {
      await pasteButton!.props.onPress();
    });
    expect(mockOnKeyPress).toHaveBeenCalledWith('pasted-text');
  });

  it('does not show Ctrl row initially', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const json = JSON.stringify(tree?.toJSON());
    expect(json).not.toContain('Ctrl mode');
  });

  it('shows Ctrl row after Ctrl toggle', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const ctrlButton = findTouchableByText(tree!.root, 'Ctrl');
    expect(ctrlButton).toBeTruthy();
    act(() => {
      ctrlButton!.props.onPress();
    });
    const json = JSON.stringify(tree?.toJSON());
    expect(json).toContain('Ctrl mode');
  });

  it('hides Ctrl row after pressing a Ctrl key', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    // Toggle Ctrl on
    const ctrlButton = findTouchableByText(tree!.root, 'Ctrl');
    expect(ctrlButton).toBeTruthy();
    act(() => {
      ctrlButton!.props.onPress();
    });
    let json = JSON.stringify(tree?.toJSON());
    expect(json).toContain('Ctrl mode');

    // Find the 'C' Ctrl key button
    const ctrlCButton = findTouchableByText(tree!.root, 'C');
    expect(ctrlCButton).toBeTruthy();
    act(() => {
      ctrlCButton!.props.onPress();
    });
    expect(mockOnKeyPress).toHaveBeenCalledWith('\x03', { noFocus: true });
    json = JSON.stringify(tree?.toJSON());
    expect(json).not.toContain('Ctrl mode');
  });

  it('uses theme colors from useTheme', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const json = JSON.stringify(tree?.toJSON());
    expect(json).toContain(mockTheme.colors.surfaceHover);
    expect(json).toContain(mockTheme.colors.textPrimary);
  });
});
