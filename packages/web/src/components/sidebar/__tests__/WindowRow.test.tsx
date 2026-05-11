import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TmuxWindow } from '@zenterm/shared';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { WindowRow } from '../WindowRow';

const window: TmuxWindow = {
  index: 1,
  name: 'test',
  active: false,
  zoomed: false,
  paneCount: 1,
  cwd: '/home/me',
};

describe('WindowRow', () => {
  it('renders window name', () => {
    render(
      <WindowRow
        sessionDisplayName="dev"
        window={window}
        isActive={false}
        isOccupiedElsewhere={false}
        openInPaneOptions={[]}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
      />,
    );
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('clicking row calls onSelect', async () => {
    const onSelect = vi.fn();
    render(
      <WindowRow
        sessionDisplayName="dev"
        window={window}
        isActive={false}
        isOccupiedElsewhere={false}
        openInPaneOptions={[]}
        onSelect={onSelect}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText('test'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('Rename via kebab triggers onRename with new name', async () => {
    const onRename = vi.fn();
    render(
      <WindowRow
        sessionDisplayName="dev"
        window={window}
        isActive={false}
        isOccupiedElsewhere={false}
        openInPaneOptions={[]}
        onSelect={vi.fn()}
        onRename={onRename}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Actions for window test/));
    await userEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'renamed{Enter}');
    expect(onRename).toHaveBeenCalledWith('dev', 1, 'renamed');
  });

  it('Delete via kebab calls onRequestDelete', async () => {
    const onRequestDelete = vi.fn();
    render(
      <WindowRow
        sessionDisplayName="dev"
        window={window}
        isActive={false}
        isOccupiedElsewhere={false}
        openInPaneOptions={[]}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={onRequestDelete}
        onOpenInPane={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Actions for window test/));
    await userEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    expect(onRequestDelete).toHaveBeenCalledWith('dev', window);
  });
});

beforeEach(() => {
  useSettingsStore.setState({ language: 'en' } as any);
  initI18n();
});

const baseWindow = {
  index: 0,
  name: 'main',
  active: true,
  zoomed: false,
  paneCount: 1,
  cwd: '/',
};

describe('WindowRow duplicate guard', () => {
  it('isOccupiedElsewhere=true で disabled + ⛔ プレフィックス', () => {
    render(
      <WindowRow
        sessionDisplayName="dev"
        window={baseWindow}
        isActive={false}
        isOccupiedElsewhere
        openInPaneOptions={[]}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: /main/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/⛔/);
  });

  it('isOccupiedElsewhere=true のとき onSelect は呼ばれない', () => {
    const onSelect = vi.fn();
    render(
      <WindowRow
        sessionDisplayName="dev"
        window={baseWindow}
        isActive={false}
        isOccupiedElsewhere
        openInPaneOptions={[]}
        onSelect={onSelect}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /main/ }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('WindowRow openInPane menu', () => {
  it('openInPaneOptions が空でないときメニューに「Open in pane N」項目が出る', () => {
    render(
      <WindowRow
        sessionDisplayName="dev"
        window={baseWindow}
        isActive={false}
        isOccupiedElsewhere={false}
        openInPaneOptions={[1, 2]}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText(/actions for window/i));
    expect(screen.getByRole('menuitem', { name: /open in pane 2/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /open in pane 3/i })).toBeInTheDocument(); // 1-based label, 0-based idx
  });

  it('「Open in pane N」クリックで onOpenInPane(idx) が呼ばれる (0-based)', () => {
    const onOpenInPane = vi.fn();
    render(
      <WindowRow
        sessionDisplayName="dev"
        window={baseWindow}
        isActive={false}
        isOccupiedElsewhere={false}
        openInPaneOptions={[1, 2]}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={onOpenInPane}
      />,
    );
    fireEvent.click(screen.getByLabelText(/actions for window/i));
    fireEvent.click(screen.getByRole('menuitem', { name: /open in pane 3/i }));
    expect(onOpenInPane).toHaveBeenCalledWith(2);
  });
});
