import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewSessionButton } from '../NewSessionButton';

describe('NewSessionButton', () => {
  it('shows "+ 新規セッション" label initially', () => {
    render(<NewSessionButton onCreate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /新規セッション/ })).toBeInTheDocument();
  });

  it('clicking shows InlineEdit, Enter calls onCreate', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<NewSessionButton onCreate={onCreate} />);
    await userEvent.click(screen.getByRole('button', { name: /新規セッション/ }));
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'new1{Enter}');
    expect(onCreate).toHaveBeenCalledWith('new1');
  });

  it('Enter on empty input calls onCreate with undefined (server default)', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<NewSessionButton onCreate={onCreate} />);
    await userEvent.click(screen.getByRole('button', { name: /新規セッション/ }));
    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.keyboard('{Enter}');
    expect(onCreate).toHaveBeenCalledWith(undefined);
  });

  it('Esc cancels back to button', async () => {
    render(<NewSessionButton onCreate={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /新規セッション/ }));
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /新規セッション/ })).toBeInTheDocument();
  });
});
