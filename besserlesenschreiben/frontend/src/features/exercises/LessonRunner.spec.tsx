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
    data: { starsAwarded: 3, streakDays: 1, league: { tier: 'bronze' } },
    isPending: false,
  }),
}));

const countItem = (session as unknown as { items: Exercise[] }).items.find((i) => i.type === 'count')!;

function oneItemSession(): SessionResponse {
  return { sessionId: 'sess-1', items: [countItem] } as unknown as SessionResponse;
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

    // count fixture: 2 syllables → correct option is "2"
    await user.click(screen.getByRole('button', { name: '2' }));
    expect(recordAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess-1', itemId: countItem.id, isCorrect: true }),
    );

    // after the ~900ms post-solve delay the session completes and the reward screen shows
    expect(await screen.findByText('Geschafft!')).toBeInTheDocument();
    expect(mutate).toHaveBeenCalledWith('sess-1');
    expect(screen.getByText('+3 Sterne')).toBeInTheDocument();
  });
});
