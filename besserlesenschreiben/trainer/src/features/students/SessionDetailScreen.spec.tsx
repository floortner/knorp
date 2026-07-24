import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { StudentSessionDetail } from '@/lib/contract';
import { studentsApi } from '@/lib/endpoints';
import { SessionDetailScreen } from './SessionDetailScreen';

vi.mock('@/lib/endpoints', () => ({
  studentsApi: { list: vi.fn(), detail: vi.fn(), sessions: vi.fn(), session: vi.fn() },
}));

const session: StudentSessionDetail = {
  sessionId: 's1',
  source: 'bank',
  name: 'Mia Muster',
  startedAt: '2026-01-05T09:00:00.000Z',
  completedAt: '2026-01-05T09:07:00.000Z',
  abandoned: false,
  itemsTotal: 1,
  itemsAnswered: 1,
  attemptCount: 2,
  correctPct: 50,
  activeMs: 6000,
  attempts: [
    {
      attemptId: 'a1',
      itemId: 'i1',
      exerciseType: 'placeholder',
      prompt: 'Wie schreibt man das Wort?',
      expected: 'Haus',
      given: 'Hauss',
      isCorrect: false,
      timeMs: 4000,
      attemptNo: 1,
      skillTags: ['spelling'],
      createdAt: '2026-01-05T09:00:30.000Z',
    },
    {
      attemptId: 'a2',
      itemId: 'i1',
      exerciseType: 'placeholder',
      prompt: 'Wie schreibt man das Wort?',
      expected: 'Haus',
      given: 'Haus',
      isCorrect: true,
      timeMs: 2000,
      attemptNo: 2,
      skillTags: ['spelling'],
      createdAt: '2026-01-05T09:01:00.000Z',
    },
  ],
};

function renderSession() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/students/p1/sessions/s1']}>
        <Routes>
          <Route path="/students/:profileId/sessions/:sessionId" element={<SessionDetailScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('SessionDetailScreen', () => {
  it('renders attempts in order with the expected answer on wrong tries and a retry badge', async () => {
    vi.mocked(studentsApi.session).mockResolvedValue(session);
    renderSession();
    expect(await screen.findByText('50% richtig')).toBeInTheDocument();
    // the back-link name comes from the session payload — no separate progress fetch
    expect(screen.getByRole('link', { name: /Mia Muster/ })).toBeInTheDocument();
    expect(studentsApi.detail).not.toHaveBeenCalled();
    // wrong first try shows the student's answer + the correction; the retry carries a badge
    expect(screen.getByText('Hauss')).toBeInTheDocument();
    expect(screen.getByText('Richtig wäre: Haus')).toBeInTheDocument();
    expect(screen.getByText('2. Versuch')).toBeInTheDocument();
    // the correct retry has no correction line of its own
    expect(screen.getAllByText(/Richtig wäre/)).toHaveLength(1);
    // timing rendered in seconds
    expect(screen.getByText('4.0 s')).toBeInTheDocument();
  });

  it('does NOT show retry badges for homework items (attemptNo is a positional index there)', async () => {
    // Homework items are distinct questions written with attemptNo 1..N to satisfy the unique index —
    // not re-tries. review.service stores them itemId=null; the drill-down must not read them as retries.
    vi.mocked(studentsApi.session).mockResolvedValue({
      ...session,
      source: 'homework',
      attempts: session.attempts.map((a, i) => ({
        ...a,
        attemptId: `hw${i}`,
        source: undefined as never,
        attemptNo: i + 1, // 1, 2 — positional, NOT a retry
        expected: '',
      })),
    });
    renderSession();
    await screen.findByText('50% richtig');
    expect(screen.queryByText(/Versuch/)).not.toBeInTheDocument();
  });

  it('shows a friendly not-found state with a way back', async () => {
    vi.mocked(studentsApi.session).mockRejectedValue(new Error('404'));
    renderSession();
    expect(await screen.findByText('Diese Sitzung wurde nicht gefunden.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zurück zur Aktivität' })).toHaveAttribute('href', '/students/p1');
  });
});
