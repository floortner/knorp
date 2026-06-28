import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Me, Unit } from '@/lib/types';

const me: Me = {
  account: { id: 'acc-1', email: 'mia@test.de' },
  profiles: [
    {
      id: 'prof-1', name: 'Mia', buddy: 'nepo', goalPerWeek: 5, soundOn: true,
      dyslexicFont: false, fontScale: 1, stars: 240, streakDays: 3, unlockedUnit: 1,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],
};
const units: Unit[] = [
  { unit: 1, title: 'Einheit 1', subtitle: 'Silben hören', focus: '', exerciseTypes: ['count'], itemCount: 4, status: 'current', theme: { iconBg: '#DFF0EC', iconColor: '#1E8275' } },
  { unit: 2, title: 'Einheit 2', subtitle: 'Silben klatschen', focus: '', exerciseTypes: ['gap'], itemCount: 4, status: 'locked', theme: { iconBg: '#EFE6FB', iconColor: '#8B45D6' } },
];

vi.mock('@/lib/endpoints', () => ({
  coreApi: {
    me: () => Promise.resolve(me),
    units: () => Promise.resolve(units),
    createSession: vi.fn(),
  },
}));

// Imported after the mock is registered.
const { Lernen } = await import('./Lernen');

function renderHome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Lernen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Lernen home', () => {
  it('renders the profile, stars and unit cards from live data', async () => {
    renderHome();
    expect(await screen.findByText('Mia')).toBeInTheDocument();
    expect(screen.getByLabelText('240 Sterne')).toBeInTheDocument();
    expect(await screen.findByText('Einheit 1')).toBeInTheDocument();
    expect(screen.getByText('Einheit 2')).toBeInTheDocument();
    // The current unit exposes a start button; locked units do not.
    expect(screen.getByRole('button', { name: /Einheit 1 üben/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Einheit 2 üben/i })).not.toBeInTheDocument();
  });
});
