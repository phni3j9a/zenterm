import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../LoginForm';

/** Paste a 4-digit string into the first OTP box (fills all boxes). */
async function pasteOtp(digits: string) {
  const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
  boxes[0].focus();
  await userEvent.paste(digits);
}

describe('LoginForm', () => {
  it('disables submit until 4 digits entered', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    const submit = screen.getByRole('button', { name: /Sign in/i });
    expect(submit).toBeDisabled();

    // Paste only 2 digits — should still be disabled
    await pasteOtp('12');
    expect(submit).toBeDisabled();

    // Paste full 4 digits — should now be enabled
    await pasteOtp('1234');
    expect(submit).toBeEnabled();
  });

  it('rejects non-digit characters', async () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    // Type mixed chars — only digits should accumulate
    boxes[0].focus();
    await userEvent.keyboard('a');
    await userEvent.keyboard('1');
    await userEvent.keyboard('b');
    await userEvent.keyboard('2');
    // boxes[0] should have '1', boxes[1] should have '2'
    expect(boxes[0].value).toBe('1');
    expect(boxes[1].value).toBe('2');
  });

  it('calls onSubmit with token on submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} />);
    await pasteOtp('5678');
    await userEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    expect(onSubmit).toHaveBeenCalledWith('5678');
  });

  it('shows error when onSubmit throws', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Token が違います'));
    render(<LoginForm onSubmit={onSubmit} />);
    await pasteOtp('0000');
    await userEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Token が違います/);
  });

  it('shows the gateway URL', () => {
    render(<LoginForm onSubmit={vi.fn()} gatewayUrl="http://gateway.test:18765" />);
    expect(screen.getByText(/gateway\.test/)).toBeInTheDocument();
  });
});
