import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomeworkScreen } from './HomeworkScreen';

vi.mock('@/features/profile/useMe', () => ({
  useActiveProfile: () => ({ id: 'p1', name: 'Mia' }),
}));

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HomeworkScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HomeworkScreen (idle)', () => {
  it('shows the upload entry + the human-review consent copy (no draft/confirm UI)', () => {
    renderScreen();
    expect(screen.getByRole('button', { name: /Foto auswählen/ })).toBeInTheDocument();
    expect(screen.getByText(/Fachkraft/)).toBeInTheDocument();
    expect(screen.getByText(/nicht automatisch/)).toBeInTheDocument();
    // never an accept/reject control in the family app
    expect(screen.queryByRole('button', { name: /annehmen|ablehnen|bestätigen/i })).toBeNull();
  });
});
