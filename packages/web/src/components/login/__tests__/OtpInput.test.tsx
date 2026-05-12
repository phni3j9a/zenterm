import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OtpInput } from '../OtpInput';

describe('OtpInput', () => {
  it('renders 4 input boxes', () => {
    render(<OtpInput value="" onChange={() => {}} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(4);
  });
  it('typing a digit moves focus to next box', async () => {
    const handler = vi.fn();
    render(<OtpInput value="" onChange={handler} />);
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    boxes[0].focus();
    await userEvent.keyboard('1');
    expect(handler).toHaveBeenCalledWith('1');
    expect(document.activeElement).toBe(boxes[1]);
  });
  it('Backspace clears current digit and moves focus back', async () => {
    const handler = vi.fn();
    render(<OtpInput value="12" onChange={handler} />);
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    boxes[2].focus();
    await userEvent.keyboard('{Backspace}');
    expect(handler).toHaveBeenCalledWith('1');
    expect(document.activeElement).toBe(boxes[1]);
  });
  it('paste fills all 4 boxes', async () => {
    const handler = vi.fn();
    render(<OtpInput value="" onChange={handler} />);
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    boxes[0].focus();
    await userEvent.paste('1234');
    expect(handler).toHaveBeenCalledWith('1234');
  });
  it('non-digit input is ignored', async () => {
    const handler = vi.fn();
    render(<OtpInput value="" onChange={handler} />);
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    boxes[0].focus();
    await userEvent.keyboard('a');
    expect(handler).not.toHaveBeenCalled();
  });
  it('ArrowLeft / ArrowRight move focus', async () => {
    render(<OtpInput value="" onChange={() => {}} />);
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    boxes[2].focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(boxes[1]);
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(boxes[2]);
  });
});
