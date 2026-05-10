import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewWindowButton } from '../NewWindowButton';

describe('NewWindowButton', () => {
  it('shows "+ window" label initially', () => {
    render(<NewWindowButton onCreate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /\+ window/ })).toBeInTheDocument();
  });

  it('clicking shows InlineEdit; Enter with text calls onCreate(name)', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<NewWindowButton onCreate={onCreate} />);
    await userEvent.click(screen.getByRole('button', { name: /\+ window/ }));
    await userEvent.type(screen.getByRole('textbox'), 'logs{Enter}');
    expect(onCreate).toHaveBeenCalledWith('logs');
  });

  it('Enter with empty calls onCreate(undefined)', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<NewWindowButton onCreate={onCreate} />);
    await userEvent.click(screen.getByRole('button', { name: /\+ window/ }));
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.keyboard('{Enter}');
    expect(onCreate).toHaveBeenCalledWith(undefined);
  });
});
