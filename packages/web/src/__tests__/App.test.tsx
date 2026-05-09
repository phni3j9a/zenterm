import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';

describe('App', () => {
  it('renders ZenTerm heading on root', () => {
    render(
      <MemoryRouter initialEntries={['/web']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /ZenTerm/i })).toBeInTheDocument();
  });
});
