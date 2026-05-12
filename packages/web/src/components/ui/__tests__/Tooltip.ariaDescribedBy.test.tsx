import { describe, it, expect } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { Tooltip } from '../Tooltip';

describe('Tooltip aria-describedby merging', () => {
  it('preserves existing aria-describedby when tooltip is visible', async () => {
    const { getByRole } = render(
      <Tooltip label="Hover hint">
        <button aria-describedby="existing-help">Click me</button>
      </Tooltip>,
    );
    const button = getByRole('button');
    expect(button.getAttribute('aria-describedby')).toBe('existing-help');

    await act(async () => {
      fireEvent.mouseEnter(button);
      await new Promise((r) => setTimeout(r, 600));
    });

    const describedBy = button.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(describedBy).toContain('existing-help');
    expect(describedBy!.split(' ').length).toBe(2);
  });

  it('uses only its own id when child has no aria-describedby', async () => {
    const { getByRole } = render(
      <Tooltip label="Hint">
        <button>Click</button>
      </Tooltip>,
    );
    const button = getByRole('button');
    await act(async () => {
      fireEvent.mouseEnter(button);
      await new Promise((r) => setTimeout(r, 600));
    });
    const describedBy = button.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(describedBy!.split(' ').length).toBe(1);
  });

  it('restores original aria-describedby when tooltip hides', async () => {
    const { getByRole } = render(
      <Tooltip label="Hint">
        <button aria-describedby="orig">Click</button>
      </Tooltip>,
    );
    const button = getByRole('button');
    await act(async () => {
      fireEvent.mouseEnter(button);
      await new Promise((r) => setTimeout(r, 600));
    });
    expect(button.getAttribute('aria-describedby')).toContain('orig');
    await act(async () => {
      fireEvent.mouseLeave(button);
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(button.getAttribute('aria-describedby')).toBe('orig');
  });
});
