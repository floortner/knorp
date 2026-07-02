import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Me, Progress } from '@/lib/types';
import { AuthProvider } from '@/features/auth/AuthProvider';

const me: Me = {
  account: { id: 'a1', email: 'm@test.de' },
  profiles: [
    { id: 'p1', name: 'Mia', buddy: 'nepo', goalPerWeek: 5, soundOn: true, dyslexicFont: false, fontScale: 1, stars: 240, streakDays: 3, unlockedUnit: 1, createdAt: '2026-01-01T00:00:00Z' },
  ],
};
const progress: Progress = {
  streakDays: 3, stars: 240, weeklyActivity: [0, 0, 0, 0, 0, 0, 1],
  monthlyHeatmap: [], league: { tier: 'bronze', starsWeek: 15, starsToNext: 85 },
  skillBreakdown: [{ skill: 'vowel_length', attempts: 3, correctPct: 100, due: false }],
};
const updateSettings = vi.fn().mockResolvedValue({ profile: me.profiles[0] });

vi.mock('@/lib/endpoints', () => ({
  coreApi: {
    me: () => Promise.resolve(me),
    progress: () => Promise.resolve(progress),
    updateSettings: (id: string, body: unknown) => updateSettings(id, body),
  },
}));

const { Profil } = await import('./Profil');

function renderProfil() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <MemoryRouter>
          <Profil />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => updateSettings.mockClear());

describe('Profil', () => {
  it('shows the child header and skill breakdown', async () => {
    renderProfil();
    expect(await screen.findByText('Mia')).toBeInTheDocument();
    expect(screen.getByText(/aktiv seit/)).toBeInTheDocument();
    expect(await screen.findByText('vowel_length')).toBeInTheDocument();
  });

  it('toggles sound off via PATCH settings', async () => {
    const user = userEvent.setup();
    renderProfil();
    await user.click(await screen.findByRole('switch', { name: 'Ton an/aus' }));
    expect(updateSettings).toHaveBeenCalledWith('p1', { soundOn: false });
  });

  // NOTE: the Schriftgröße ("Groß") control was removed in milestone 1.6 (the font-scale stub was cut),
  // so there is no longer a font-scale PATCH from this screen — the test for it was removed with it.
});
