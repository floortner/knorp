import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LectureAssignment, LectureDetail } from '@/lib/contract';
import { lecturesApi } from '@/lib/endpoints';
import { LectureDetailScreen } from './LectureDetailScreen';

vi.mock('@/lib/endpoints', () => ({
  lecturesApi: { list: vi.fn(), create: vi.fn(), detail: vi.fn(), update: vi.fn(), remove: vi.fn(), publish: vi.fn(), unpublish: vi.fn(), assign: vi.fn(), assignments: vi.fn(), withdraw: vi.fn() },
  studentsApi: { list: vi.fn(), detail: vi.fn(), sessions: vi.fn(), session: vi.fn() },
}));

const detail: LectureDetail = {
  lectureId: 'l1',
  title: 'Dehnungs-h entdecken',
  status: 'published',
  skillTags: ['placeholder'],
  itemCount: 1,
  authorName: 'Angelika',
  assignmentCounts: { open: 1, started: 0, completed: 1 },
  createdAt: '2026-07-25T09:00:00.000Z',
  updatedAt: '2026-07-25T10:00:00.000Z',
  intro: 'Merke: Das h macht lang.',
  items: [
    { id: 'i1', type: 'placeholder', prompt: 'Welches Wort?', options: ['fahren', 'fallen'], answer: 'fahren', praise: 'Toll!', audioUrl: null, syllableAudio: null, skillTags: ['placeholder'] },
  ],
};

const completed: LectureAssignment = {
  assignmentId: 'a1',
  profileId: 'p1',
  name: 'Mia Muster',
  status: 'completed',
  assignedAt: '2026-07-24T09:00:00.000Z',
  sessionId: 's1',
  completedAt: '2026-07-24T10:00:00.000Z',
  correctPct: 80,
  itemsAnswered: 1,
  itemsTotal: 1,
  activeMs: 12000,
};

const open: LectureAssignment = {
  assignmentId: 'a2',
  profileId: 'p2',
  name: 'Theo Test',
  status: 'open',
  assignedAt: '2026-07-24T09:00:00.000Z',
  sessionId: null,
  completedAt: null,
  correctPct: null,
  itemsAnswered: 0,
  itemsTotal: 0,
  activeMs: 0,
};

function renderDetail() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/lectures/l1']}>
        <Routes>
          <Route path="/lectures/:lectureId" element={<LectureDetailScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('LectureDetailScreen', () => {
  it('shows the Merksatz, marks the correct option, and links completed rows to the drill-down', async () => {
    vi.mocked(lecturesApi.detail).mockResolvedValue(detail);
    vi.mocked(lecturesApi.assignments).mockResolvedValue({ items: [completed, open] });
    renderDetail();
    expect(await screen.findByText('Merke: Das h macht lang.')).toBeInTheDocument();
    expect(screen.getByText('fahren')).toBeInTheDocument();
    // completed row: outcome + drill-down link, calm status wording
    expect(await screen.findByText(/1\/1 Aufgaben · 80% richtig/)).toBeInTheDocument();
    expect(screen.getAllByText('Erledigt')).toHaveLength(2); // filter chip + status badge
    expect(screen.getByRole('link', { name: /Details/ })).toHaveAttribute('href', '/students/p1/sessions/s1');
    // open row stays withdrawable, never pressured
    expect(screen.getAllByText('Offen')).toHaveLength(2); // filter chip + status badge
    expect(screen.getByRole('button', { name: 'Zurückziehen' })).toBeInTheDocument();
    expect(screen.queryByText(/überfällig/i)).not.toBeInTheDocument();
  });

  it('published lectures offer Zuweisen; the assign dialog opens with the student list', async () => {
    vi.mocked(lecturesApi.detail).mockResolvedValue(detail);
    vi.mocked(lecturesApi.assignments).mockResolvedValue({ items: [] });
    const { studentsApi } = await import('@/lib/endpoints');
    vi.mocked(studentsApi.list).mockResolvedValue({
      items: [
        { profileId: 'p1', name: 'Mia Muster', unit: 3, streakDays: 0, lastActive: null, sessions7d: 0, sessions30d: 0, totalAttempts: 0, weakestSkills: [] },
      ],
      nextCursor: null,
      total: 1,
    });
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    renderDetail();
    await user.click(await screen.findByRole('button', { name: /Zuweisen/ }));
    expect(await screen.findByText('Lektion zuweisen')).toBeInTheDocument();
    expect(await screen.findByText('Mia Muster')).toBeInTheDocument();
  });
});
