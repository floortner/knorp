import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LectureListItem } from '@/lib/contract';
import { lecturesApi } from '@/lib/endpoints';
import { LecturesScreen } from './LecturesScreen';

vi.mock('@/lib/endpoints', () => ({
  lecturesApi: { list: vi.fn(), create: vi.fn(), detail: vi.fn(), update: vi.fn(), remove: vi.fn(), publish: vi.fn(), unpublish: vi.fn(), assign: vi.fn(), assignments: vi.fn(), withdraw: vi.fn() },
}));

const lecture: LectureListItem = {
  lectureId: 'l1',
  title: 'Dehnungs-h entdecken',
  status: 'published',
  skillTags: ['placeholder'],
  itemCount: 3,
  authorName: 'Angelika',
  assignmentCounts: { open: 2, started: 1, completed: 4 },
  createdAt: '2026-07-25T09:00:00.000Z',
  updatedAt: '2026-07-25T10:00:00.000Z',
};

function renderList() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LecturesScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('LecturesScreen', () => {
  it('lists lectures with status, item count, author and calm status counts', async () => {
    vi.mocked(lecturesApi.list).mockResolvedValue({ items: [lecture], nextCursor: null, total: 1 });
    renderList();
    expect(await screen.findByText('Dehnungs-h entdecken')).toBeInTheDocument();
    expect(screen.getByText('Veröffentlicht')).toBeInTheDocument();
    expect(screen.getByText(/3 Aufgaben · von Angelika · Offen 2 · Begonnen 1 · Erledigt 4/)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/lectures/l1');
  });

  it('shows the empty state with the create button', async () => {
    vi.mocked(lecturesApi.list).mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    renderList();
    expect(await screen.findByText('Noch keine Lektionen.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Neue Lektion/ })).toBeInTheDocument();
  });
});
