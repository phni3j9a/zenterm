import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { usePaneStore } from '@/stores/pane';
import { LayoutSelector } from '../LayoutSelector';

beforeEach(() => {
  useSettingsStore.setState({ language: 'en', fontSize: 14 } as any);
  initI18n();
  window.localStorage.clear();
  usePaneStore.setState({
    layout: 'single',
    panes: [null],
    focusedIndex: 0,
    ratios: {
      single: [],
      'cols-2': [0.5],
      'cols-3': [1 / 3, 0.5],
      'grid-2x2': [0.5, 0.5],
      'main-side-2': [0.6, 0.5],
    },
    savedLayout: null,
  });
});

describe('LayoutSelector', () => {
  it('ボタンクリックで 5 種のメニュー項目が出る', () => {
    render(<LayoutSelector />);
    fireEvent.click(screen.getByRole('button', { name: /layout/i }));
    expect(screen.getByRole('menuitem', { name: /single/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /2 cols/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /3 cols/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /2x2/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /main \+ 2 side/i })).toBeInTheDocument();
  });

  it('メニュー項目クリックで paneStore.setLayout が呼ばれる', () => {
    render(<LayoutSelector />);
    fireEvent.click(screen.getByRole('button', { name: /layout/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /2x2/i }));
    expect(usePaneStore.getState().layout).toBe('grid-2x2');
  });

  it('現在の layout はメニュー上で aria-checked', () => {
    usePaneStore.getState().setLayout('cols-2');
    render(<LayoutSelector />);
    fireEvent.click(screen.getByRole('button', { name: /layout/i }));
    const checked = screen.getByRole('menuitem', { name: /2 cols/i });
    expect(checked.getAttribute('aria-checked')).toBe('true');
  });

  it('Escape でメニューが閉じる', () => {
    render(<LayoutSelector />);
    fireEvent.click(screen.getByRole('button', { name: /layout/i }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menuitem')).toBeNull();
  });
});
