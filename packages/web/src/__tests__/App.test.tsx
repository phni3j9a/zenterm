import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { useAuthStore } from '../stores/auth';

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({ token: null, gatewayUrl: null });
  });

  it('redirects unauthed user to /web/login showing the form', () => {
    render(
      <MemoryRouter initialEntries={['/web']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /ZenTerm Web/i })).toBeInTheDocument();
  });

  it('shows sessions placeholder when authed', () => {
    useAuthStore.setState({ token: '1234', gatewayUrl: 'http://gateway.test:18765' });
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /Sessions/i })).toBeInTheDocument();
  });
});
