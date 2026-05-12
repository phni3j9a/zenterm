import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Stepper } from '../Stepper';
import type { StepperStep } from '../Stepper';

const steps: StepperStep[] = [
  { title: 'Step One', status: 'done' },
  { title: 'Step Two', status: 'current', description: 'Do something' },
  { title: 'Step Three', status: 'pending' },
];

describe('Stepper', () => {
  it('renders all step titles', () => {
    render(<Stepper steps={steps} />);
    expect(screen.getByText('Step One')).toBeInTheDocument();
    expect(screen.getByText('Step Two')).toBeInTheDocument();
    expect(screen.getByText('Step Three')).toBeInTheDocument();
  });

  it('renders as an ordered list', () => {
    render(<Stepper steps={steps} />);
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('marks only the current step with aria-current="step"', () => {
    render(<Stepper steps={steps} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).not.toHaveAttribute('aria-current');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[2]).not.toHaveAttribute('aria-current');
  });

  it('shows ✓ for done steps', () => {
    render(<Stepper steps={steps} />);
    // aria-hidden div for step 1 shows ✓
    const allText = document.body.textContent ?? '';
    expect(allText).toContain('✓');
  });

  it('shows step number for pending and current steps', () => {
    render(<Stepper steps={steps} />);
    const allText = document.body.textContent ?? '';
    expect(allText).toContain('2'); // step 2 (current)
    expect(allText).toContain('3'); // step 3 (pending)
  });

  it('renders description when provided', () => {
    render(<Stepper steps={steps} />);
    expect(screen.getByText('Do something')).toBeInTheDocument();
  });

  it('does not render description when omitted', () => {
    render(<Stepper steps={[{ title: 'Only title', status: 'pending' }]} />);
    // With no description, there's no extra div after the title div
    expect(screen.queryByText('Do something')).toBeNull();
    // The step title is present
    expect(screen.getByText('Only title')).toBeInTheDocument();
  });
});
