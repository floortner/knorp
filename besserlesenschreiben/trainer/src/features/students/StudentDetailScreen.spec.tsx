import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { StudentDetail, StudentSession } from '@/lib/contract';
import { studentsApi } from '@/lib/endpoints';
import { StudentDetailScreen } from './StudentDetailScreen';

vi.mock('@/lib/endpoints', () => ({
  studentsApi: { list: vi.fn(), detail: vi.fn(), sessions: vi.fn(), session: vi.fn() },
}));

const detail: StudentDetail = {
  profileId: 'p1',
  name: 'Mia Muster',
  summary: {
    unit: 3,
    streakDays: 4,
    stars: 120,
    lastActive: '2026-07-24T00:00:00.000Z',
    league: { tier: 'bronze', starsWeek: 30, starsToNext: 20 },
  },
  skills: [{ skill: 'vowel_length', attempts: 10, correctPct: 40, due: true }],
  activity: { totalAttempts: 42, sessions7d: 2, sessions30d: 5, homework: [] },
};

const completed: StudentSession = {
  sessionId: 's1',
  source: 'bank',
  startedAt: '2026-01-05T09:00:00.000Z',
  completedAt: '2026-01-05T09:07:00.000Z',
  abandoned: false,
  itemsTotal: 5,
  itemsAnswered: 5,
  attemptCount: 6,
  correctPct: 83,
  activeMs: 60000,
};

const abandoned: StudentSession = {
  sessionId: 's2',
  source: 'bank',
  startedAt: '2026-01-04T10:00:00.000Z',
  completedAt: null,
  abandoned: true,
  itemsTotal: 5,
  itemsAnswered: 2,
  attemptCount: 2,
  correctPct: 50,
  activeMs: 20000,
};

const homework: StudentSession = {
  sessionId: 's3',
  source: 'homework',
  startedAt: '2026-01-03T10:00:00.000Z',
  completedAt: null,
  abandoned: false,
  itemsTotal: 0,
  itemsAnswered: 3,
  attemptCount: 3,
  correctPct: 67,
  activeMs: 0,
};

function renderDetail() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/students/p1']}>
        <Routes>
          <Route path="/students/:profileId" element={<StudentDetailScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('StudentDetailScreen', () => {
  it('renders the progress header and the day-grouped timeline with calm abandoned + homework rows', async () => {
    vi.mocked(studentsApi.detail).mockResolvedValue(detail);
    vi.mocked(studentsApi.sessions).mockResolvedValue({
      items: [completed, abandoned, homework],
      nextCursor: null,
      total: 3,
    });
    renderDetail();
    expect(await screen.findByText('Mia Muster')).toBeInTheDocument();
    // completed row: answered/total + accuracy + duration
    expect(await screen.findByText(/5\/5 Aufgaben · 83% richtig · 7 Min\./)).toBeInTheDocument();
    // abandoned row: neutral factual marker, partial progress — no duration
    expect(screen.getByText('nicht abgeschlossen')).toBeInTheDocument();
    expect(screen.getByText(/2\/5 Aufgaben$/)).toBeInTheDocument();
    // homework row: terminal by design — no "0/0 Aufgaben", no abandoned marker
    expect(screen.getByText('Hausübung geprüft')).toBeInTheDocument();
    expect(screen.queryByText(/0\/0/)).not.toBeInTheDocument();
    // rows with attempts link to the drill-down
    const links = screen.getAllByRole('link').map((l) => l.getAttribute('href'));
    expect(links).toContain('/students/p1/sessions/s1');
  });

  it('shows a completed zero-attempt session as items only, never a misleading "0% richtig"', async () => {
    vi.mocked(studentsApi.detail).mockResolvedValue(detail);
    vi.mocked(studentsApi.sessions).mockResolvedValue({
      items: [{ ...completed, sessionId: 's9', attemptCount: 0, correctPct: null }],
      nextCursor: null,
      total: 1,
    });
    renderDetail();
    await screen.findByText('Mia Muster');
    expect(await screen.findByText(/5\/5 Aufgaben · 7 Min\./)).toBeInTheDocument();
    expect(screen.queryByText(/0% richtig/)).not.toBeInTheDocument();
  });

  it('re-queries server-side when a source filter chip is selected', async () => {
    vi.mocked(studentsApi.detail).mockResolvedValue(detail);
    vi.mocked(studentsApi.sessions).mockResolvedValue({ items: [homework], nextCursor: null, total: 1 });
    renderDetail();
    await screen.findByText('Mia Muster');
    await userEvent.setup().click(await screen.findByRole('tab', { name: 'Hausübungen' }));
    expect(studentsApi.sessions).toHaveBeenLastCalledWith('p1', expect.objectContaining({ source: 'homework' }));
  });
});
