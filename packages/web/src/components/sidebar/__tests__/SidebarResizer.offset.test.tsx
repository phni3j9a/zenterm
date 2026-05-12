import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { SidebarResizer } from '../SidebarResizer';
import { useLayoutStore, SIDEBAR_WIDTH_DEFAULT } from '@/stores/layout';

describe('SidebarResizer with non-zero sidebar left edge', () => {
  beforeEach(() => {
    useLayoutStore.setState({ sidebarWidth: SIDEBAR_WIDTH_DEFAULT } as any);
  });

  it('calculates width as clientX - sidebarLeftEdge', async () => {
    const Wrap = () => (
      <aside role="complementary" style={{ marginLeft: 40, width: 320, position: 'relative' }}>
        <SidebarResizer />
      </aside>
    );
    const { getByRole } = render(<Wrap />);
    const aside = document.querySelector('aside') as HTMLElement;
    aside.getBoundingClientRect = () => ({
      x: 40, y: 0, top: 0, left: 40, right: 360, bottom: 100, width: 320, height: 100,
      toJSON: () => ({}),
    });
    const handle = getByRole('separator');
    await act(async () => {
      fireEvent.pointerDown(handle, { clientX: 360, clientY: 50 });
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 440, clientY: 50, bubbles: true }));
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 440, clientY: 50 }));
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(useLayoutStore.getState().sidebarWidth).toBe(400);
  });
});
