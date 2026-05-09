import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../LoginForm';

describe('LoginForm', () => {
  it('disables submit until 4 digits entered', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    const submit = screen.getByRole('button', { name: /Connect/i });
    expect(submit).toBeDisabled();

    const input = screen.getByLabelText(/Token/i);
    await userEvent.type(input, '12');
    expect(submit).toBeDisabled();

    await userEvent.type(input, '34');
    expect(submit).toBeEnabled();
  });

  it('rejects non-digit characters', async () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    const input = screen.getByLabelText(/Token/i) as HTMLInputElement;
    await userEvent.type(input, 'a1b2c3d4');
    expect(input.value).toBe('1234');
  });

  it('calls onSubmit with token on submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} />);
    const input = screen.getByLabelText(/Token/i);
    await userEvent.type(input, '5678');
    await userEvent.click(screen.getByRole('button', { name: /Connect/i }));
    expect(onSubmit).toHaveBeenCalledWith('5678');
  });

  it('shows error when onSubmit throws', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Token が違います'));
    render(<LoginForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/Token/i), '0000');
    await userEvent.click(screen.getByRole('button', { name: /Connect/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Token が違います/);
  });

  it('shows the gateway URL', () => {
    render(<LoginForm onSubmit={vi.fn()} gatewayUrl="http://gateway.test:18765" />);
    expect(screen.getByText(/gateway\.test/)).toBeInTheDocument();
  });
});
