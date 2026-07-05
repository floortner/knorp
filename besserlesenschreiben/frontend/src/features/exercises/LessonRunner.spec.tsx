import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Exercise, SessionResponse } from '@/lib/types';
import session from '../../../fixtures/session.example.json';
import { LessonRunner } from './LessonRunner';

const recordAttempt = vi.fn();
const mutate = vi.fn();
vi.mock('@/lib/telemetry', () => ({ recordAttempt: (...a: unknown[]) => recordAttempt(...a) }));
vi.mock('@/features/settings/a11y', () => ({ useSoundOn: () => false }));
vi.mock('@/features/sessions/useCompleteSession', () => ({
  useCompleteSession: () => ({
    mutate: (...a: unknown[]) => mutate(...a),
    data: { starsAwarded: 3, streakDays: 1, jokerAvailable: true, jokerConsumed: false, league: { tier: 'bronze' } },
    isPending: false,
  }),
}));
vi.mock('@/features/profile/useMe', () => ({
  useMe: () => ({ isLoading: false, isError: false, data: undefined }),
  useActiveProfile: () => ({ id: 'prof-1', name: 'Mia', buddy: 'nepo', goalPerWeek: 5, streakDays: 3, stars: 100, soundOn: true, dyslexicFont: false, fontScale: 1, jokerAvailable: true, unlockedUnit: 1, createdAt: '2026-01-01T00:00:00Z' }),
}));

const realwordItem = (session as unknown as { items: Exercise[] }).items.find((i) => i.type === 'realword')!;

function oneItemSession(): SessionResponse {
  return { sessionId: 'sess-1', items: [realwordItem] } as unknown as SessionResponse;
}

describe('LessonRunner', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records an attempt, then completes the session after the last item is solved', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LessonRunner session={oneItemSession()} />
      </MemoryRouter>,
    );

    // realword fixture: "Tür" is a real word → tap "Echtes Wort"
    await user.click(screen.getByRole('button', { name: /Echtes Wort/ }));
    expect(recordAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess-1', itemId: realwordItem.id, isCorrect: true }),
    );

    // after the ~900ms post-solve delay the session completes and the reward screen shows
    expect(await screen.findByText('Geschafft!')).toBeInTheDocument();
    expect(mutate).toHaveBeenCalledWith('sess-1');
    expect(screen.getByText('+3 Sterne')).toBeInTheDocument();
  });

  it('shows the teaching intro first for a generated lecture, then runs exercises normally', async () => {
    const user = userEvent.setup();
    const session = { ...oneItemSession(), intro: 'Merke: Klatsch die Silben mit!' } as SessionResponse;
    render(
      <MemoryRouter>
        <LessonRunner session={session} />
      </MemoryRouter>,
    );

    // intro card first — no exercise visible, nothing emitted
    expect(screen.getByText('Merke: Klatsch die Silben mit!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Echtes Wort/ })).not.toBeInTheDocument();
    expect(recordAttempt).not.toHaveBeenCalled();

    // dismiss → first exercise appears; answering still emits exactly one attempt
    await user.click(screen.getByRole('button', { name: /Los geht's/i }));
    await user.click(screen.getByRole('button', { name: /Echtes Wort/ }));
    expect(recordAttempt).toHaveBeenCalledTimes(1);
  });

  it('skips the intro phase entirely for bank sessions (no intro field)', () => {
    render(
      <MemoryRouter>
        <LessonRunner session={oneItemSession()} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Los geht's/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Echtes Wort/ })).toBeInTheDocument();
  });
});
