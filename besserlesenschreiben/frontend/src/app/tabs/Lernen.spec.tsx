import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  { unit: 1, title: 'Einheit 1', subtitle: 'Selbstlaute entdecken', focus: '', exerciseTypes: ['findvowel'], itemCount: 4, status: 'current', theme: { iconBg: '#DFF0EC', iconColor: '#1E8275' } },
  { unit: 2, title: 'Einheit 2', subtitle: 'Das Wortraster', focus: '', exerciseTypes: ['raster'], itemCount: 4, status: 'locked', theme: { iconBg: '#EFE6FB', iconColor: '#8B45D6' } },
];

const progress = {
  streakDays: 3, stars: 240, weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
  monthlyHeatmap: [], league: { tier: 'bronze', starsWeek: 10, starsToNext: 40 },
  skillBreakdown: [],
};

vi.mock('@/lib/endpoints', () => ({
  coreApi: {
    me: () => Promise.resolve(me),
    units: () => Promise.resolve(units),
    progress: () => Promise.resolve(progress),
    createSession: vi.fn(),
  },
}));

// Imported after the mock is registered.
const { Lernen } = await import('./Lernen');
const { coreApi } = await import('@/lib/endpoints');
const { ApiError } = await import('@/lib/api');

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
  beforeEach(() => vi.mocked(coreApi.createSession).mockReset());

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

  it('✨ card requests a generated lecture (source: llm)', async () => {
    const { userEvent } = await import('@testing-library/user-event').then((m) => ({ userEvent: m.default }));
    vi.mocked(coreApi.createSession).mockResolvedValue({ sessionId: 's1', items: [] } as never);
    const user = userEvent.setup();
    renderHome();

    await user.click(await screen.findByRole('button', { name: /Neue Übungen für dich/i }));
    expect(coreApi.createSession).toHaveBeenCalledWith('prof-1', undefined, 'llm');
  });

  it('falls back to a bank session with a friendly note when the LLM is unavailable (503)', async () => {
    const { userEvent } = await import('@testing-library/user-event').then((m) => ({ userEvent: m.default }));
    vi.mocked(coreApi.createSession)
      .mockRejectedValueOnce(new ApiError(503, 'PROVIDER_UNAVAILABLE', 'KI nicht verfügbar.'))
      .mockResolvedValueOnce({ sessionId: 's2', items: [] } as never);
    const user = userEvent.setup();
    renderHome();

    await user.click(await screen.findByRole('button', { name: /Neue Übungen für dich/i }));

    expect(await screen.findByText(/Zauber-Übungen machen gerade Pause/i)).toBeInTheDocument();
    // second call is the bank fallback (no source)
    expect(coreApi.createSession).toHaveBeenCalledTimes(2);
    expect(vi.mocked(coreApi.createSession).mock.calls[1]).toEqual(['prof-1', undefined, undefined]);
  });
});
