import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineEdit } from '../InlineEdit';

describe('InlineEdit', () => {
  it('renders the initial value in an input', () => {
    render(<InlineEdit value="hello" onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('hello');
  });

  it('calls onSave with new value on Enter', async () => {
    const onSave = vi.fn();
    render(<InlineEdit value="hello" onSave={onSave} onCancel={vi.fn()} />);
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'new{Enter}');
    expect(onSave).toHaveBeenCalledWith('new');
  });

  it('calls onCancel on Escape', async () => {
    const onCancel = vi.fn();
    render(<InlineEdit value="hello" onSave={vi.fn()} onCancel={onCancel} />);
    await userEvent.type(screen.getByRole('textbox'), '{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onSave on blur (treats blur as commit)', async () => {
    const onSave = vi.fn();
    render(
      <>
        <InlineEdit value="hello" onSave={onSave} onCancel={vi.fn()} />
        <button>elsewhere</button>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: /elsewhere/i }));
    expect(onSave).toHaveBeenCalledWith('hello');
  });

  it('shows validation error and blocks save', async () => {
    const onSave = vi.fn();
    render(
      <InlineEdit
        value="ok"
        onSave={onSave}
        onCancel={vi.fn()}
        validate={(v) => (v.length < 3 ? 'too short' : null)}
      />,
    );
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'no{Enter}');
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('too short')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('autofocuses on mount', () => {
    render(<InlineEdit value="hello" onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveFocus();
  });
});
