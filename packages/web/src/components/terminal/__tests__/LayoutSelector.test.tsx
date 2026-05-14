import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { usePaneStore } from '@/stores/pane';
import { useLayoutStore } from '@/stores/layout';
import { LayoutSelector } from '../LayoutSelector';

beforeEach(() => {
  useSettingsStore.setState({ language: 'en', fontSize: 14 } as any);
  initI18n();
  window.localStorage.clear();
  useLayoutStore.setState({ sidebarCollapsed: false, paletteOpen: false, layoutMenuOpen: false });
  usePaneStore.setState({
    layout: 'single',
    panes: [null],
    focusedIndex: 0,
  });
});

describe('LayoutSelector', () => {
  it('ボタンクリックで 4 種のメニュー項目が出る (main-side-2 は廃止)', () => {
    render(<LayoutSelector />);
    fireEvent.click(screen.getByRole('button', { name: /layout/i }));
    expect(screen.getByRole('menuitemradio', { name: /single/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /2 cols/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /3 cols/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /2x2/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', { name: /main \+ 2 side/i })).toBeNull();
  });

  it('メニュー項目クリックで paneStore.setLayout が呼ばれる', () => {
    render(<LayoutSelector />);
    fireEvent.click(screen.getByRole('button', { name: /layout/i }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /2x2/i }));
    expect(usePaneStore.getState().layout).toBe('grid-2x2');
  });

  it('現在の layout はメニュー上で aria-checked', () => {
    usePaneStore.getState().setLayout('cols-2');
    render(<LayoutSelector />);
    fireEvent.click(screen.getByRole('button', { name: /layout/i }));
    const checked = screen.getByRole('menuitemradio', { name: /2 cols/i });
    expect(checked.getAttribute('aria-checked')).toBe('true');
  });

  it('Escape でメニューが閉じる', () => {
    render(<LayoutSelector />);
    fireEvent.click(screen.getByRole('button', { name: /layout/i }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menuitemradio')).toBeNull();
  });

  it('外側 pointerdown でメニューが閉じる', () => {
    render(<LayoutSelector />);
    fireEvent.click(screen.getByRole('button', { name: /layout/i }));
    expect(screen.getByRole('menuitemradio', { name: /single/i })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menuitemradio')).toBeNull();
  });
});
