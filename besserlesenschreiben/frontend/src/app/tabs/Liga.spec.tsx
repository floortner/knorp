import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Me, Progress } from '@/lib/types';

const me: Me = {
  account: { id: 'a1', email: 'm@test.de' },
  profiles: [
    { id: 'p1', name: 'Mia', buddy: 'nepo', goalPerWeek: 5, soundOn: true, dyslexicFont: false, fontScale: 1, stars: 240, streakDays: 3, unlockedUnit: 1, createdAt: '2026-01-01T00:00:00Z' },
  ],
};
const progress: Progress = {
  streakDays: 3,
  stars: 240,
  weeklyActivity: [0, 2, 4, 1, 0, 3, 2],
  monthlyHeatmap: Array.from({ length: 30 }, (_, i) => ({ date: `2026-06-${String(i + 1).padStart(2, '0')}`, count: i % 3 })),
  league: { tier: 'silber', starsWeek: 120, starsToNext: 180 },
  skillBreakdown: [{ skill: 'vowel_ie', attempts: 4, correctPct: 25, due: true }],
};

vi.mock('@/lib/endpoints', () => ({
  coreApi: { me: () => Promise.resolve(me), progress: () => Promise.resolve(progress) },
}));

const { Liga } = await import('./Liga');

function renderLiga() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Liga />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Liga', () => {
  it('renders league standing, streak/stars and the activity views', async () => {
    renderLiga();
    expect(await screen.findByText('Silber-Liga')).toBeInTheDocument();
    expect(screen.getByText(/noch 180 bis zur Gold-Liga/)).toBeInTheDocument();
    expect(screen.getByText('Diese Woche')).toBeInTheDocument();
    expect(screen.getByText('Letzte 30 Tage')).toBeInTheDocument();
  });
});
