import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPanel } from '../SettingsPanel';

describe('SettingsPanel', () => {
  it('renders the 5 section headers', () => {
    render(
      <MemoryRouter>
        <SettingsPanel />
      </MemoryRouter>,
    );
    expect(screen.getByRole('region', { name: /appearance/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /terminal/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /gateway/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /system status/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /rate limits/i })).toBeInTheDocument();
  });
});
