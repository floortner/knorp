import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { StudentListItem } from '@/lib/contract';
import { studentsApi } from '@/lib/endpoints';
import { StudentsScreen } from './StudentsScreen';

vi.mock('@/lib/endpoints', () => ({
  studentsApi: { list: vi.fn(), detail: vi.fn(), sessions: vi.fn(), session: vi.fn() },
}));

const mia: StudentListItem = {
  profileId: 'p1',
  name: 'Mia Muster',
  unit: 3,
  streakDays: 4,
  lastActive: '2026-07-24T00:00:00.000Z',
  sessions7d: 2,
  sessions30d: 5,
  totalAttempts: 42,
  weakestSkills: [{ skill: 'vowel_length', attempts: 10, correctPct: 40, due: true }],
};

function renderStudents() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <StudentsScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('StudentsScreen', () => {
  it('lists students by name with Einheit + weakest-skill chips, linking to the detail', async () => {
    vi.mocked(studentsApi.list).mockResolvedValue({ items: [mia], nextCursor: null, total: 1 });
    renderStudents();
    expect(await screen.findByText(/Mia Muster/)).toBeInTheDocument();
    expect(screen.getByText(/1 Schüler/)).toBeInTheDocument(); // directory count from `total`
    expect(screen.getByText(/Einheit 3/)).toBeInTheDocument();
    expect(screen.getByText(/vowel_length 40%/)).toBeInTheDocument();
    // Every contracted teaser field is rendered — 7d/30d sessions, streak, total attempts.
    expect(screen.getByText(/Sitzungen: 2 \(7 T\.\) · 5 \(30 T\.\)/)).toBeInTheDocument();
    expect(screen.getByText(/Serie 4 Tage · 42 Aufgaben/)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/students/p1');
  });

  it('shows the calm empty state when no students exist yet', async () => {
    vi.mocked(studentsApi.list).mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    renderStudents();
    expect(await screen.findByText('Noch keine Schüler.')).toBeInTheDocument();
  });
});
