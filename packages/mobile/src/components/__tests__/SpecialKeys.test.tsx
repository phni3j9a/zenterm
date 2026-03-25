import React from 'react';
import { create, act } from 'react-test-renderer';
import type { ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';

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
 * that contains the given label.
 */
function findTouchableByText(root: ReactTestInstance, label: string): ReactTestInstance | undefined {
  const allInstances = root.findAll((node: ReactTestInstance) => {
    if (typeof node.type === 'string' && (node.type as string) === 'Text') {
      return node.children?.some((c: unknown) => typeof c === 'string' && c === label) ?? false;
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

/**
 * Find the more (ellipsis) toggle button by icon name.
 */
function findMoreToggle(root: ReactTestInstance): ReactTestInstance | undefined {
  const icons = root.findAll((node: ReactTestInstance) => node.props.name === 'ellipsis-horizontal');
  if (icons.length === 0) return undefined;
  let node: ReactTestInstance | null = icons[0].parent;
  while (node) {
    if (node.props.onPress) return node;
    node = node.parent;
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
    expect(tree!.toJSON()).toBeTruthy();
  });

  it('renders Esc, Tab, ⇧Tab, Ctrl buttons', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('Esc');
    expect(json).toContain('Tab');
    expect(json).toContain('\u21e7Tab');
    expect(json).toContain('Ctrl');
  });

  it('renders arrow keys', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('\u2190');
    expect(json).toContain('\u2191');
    expect(json).toContain('\u2193');
    expect(json).toContain('\u2192');
  });

  it('does not render Paste button by default (hidden in more panel)', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).not.toContain('Paste');
  });

  it('renders more toggle button (ellipsis)', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('ellipsis-horizontal');
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

  it('calls onKeyPress with Shift-Tab escape sequence when ⇧Tab is pressed', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const sTabButton = findTouchableByText(tree!.root, '\u21e7Tab');
    expect(sTabButton).toBeTruthy();
    act(() => {
      sTabButton!.props.onPress();
    });
    expect(mockOnKeyPress).toHaveBeenCalledWith('\x1b[Z', { noFocus: true });
  });

  it('shows Paste button after opening more panel, and pastes text', async () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const moreButton = findMoreToggle(tree!.root);
    expect(moreButton).toBeTruthy();
    act(() => {
      moreButton!.props.onPress();
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
    const json = JSON.stringify(tree!.toJSON());
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
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('Ctrl mode');
  });

  it('hides Ctrl row after pressing a Ctrl key', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const ctrlButton = findTouchableByText(tree!.root, 'Ctrl');
    expect(ctrlButton).toBeTruthy();
    act(() => {
      ctrlButton!.props.onPress();
    });
    let json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('Ctrl mode');

    const ctrlCButton = findTouchableByText(tree!.root, 'C');
    expect(ctrlCButton).toBeTruthy();
    act(() => {
      ctrlCButton!.props.onPress();
    });
    expect(mockOnKeyPress).toHaveBeenCalledWith('\x03', { noFocus: true });
    json = JSON.stringify(tree!.toJSON());
    expect(json).not.toContain('Ctrl mode');
  });

  it('closes Ctrl panel when more panel is opened (mutually exclusive)', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const ctrlButton = findTouchableByText(tree!.root, 'Ctrl');
    act(() => {
      ctrlButton!.props.onPress();
    });
    let json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('Ctrl mode');

    const moreButton = findMoreToggle(tree!.root);
    act(() => {
      moreButton!.props.onPress();
    });
    json = JSON.stringify(tree!.toJSON());
    expect(json).not.toContain('Ctrl mode');
    expect(json).toContain('Paste');
  });

  it('uses theme colors from useTheme', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<SpecialKeys onKeyPress={mockOnKeyPress} />);
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain(mockTheme.colors.surfaceHover);
    expect(json).toContain(mockTheme.colors.textPrimary);
  });
});
