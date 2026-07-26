import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LectureListItem } from '@/lib/contract';
import { lecturesApi } from '@/lib/endpoints';
import { LecturesScreen } from './LecturesScreen';

vi.mock('@/lib/endpoints', () => ({
  lecturesApi: { list: vi.fn(), detail: vi.fn(), assign: vi.fn(), assignments: vi.fn(), withdraw: vi.fn() },
}));

const lecture: LectureListItem = {
  lectureId: 'l1',
  title: 'Dehnungs-h entdecken',
  status: 'published',
  skillTags: ['placeholder'],
  itemCount: 3,
  slug: 'dehnungs-h',
  version: 2,
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
  it('lists lectures with status, item count, version and calm status counts', async () => {
    vi.mocked(lecturesApi.list).mockResolvedValue({ items: [lecture], nextCursor: null, total: 1 });
    renderList();
    expect(await screen.findByText('Dehnungs-h entdecken')).toBeInTheDocument();
    expect(screen.getByText('Veröffentlicht')).toBeInTheDocument();
    expect(screen.getByText(/3 Aufgaben · Version 2 · Offen 2 · Begonnen 1 · Erledigt 4/)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/lectures/l1');
  });

  it('is read-only: content-library provenance instead of a create button', async () => {
    vi.mocked(lecturesApi.list).mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    renderList();
    expect(await screen.findByText('Noch keine Lektionen in der Content-Bibliothek.')).toBeInTheDocument();
    expect(screen.getByText(/kommen aus der Content-Bibliothek \(GitHub\)/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Neue Lektion/ })).not.toBeInTheDocument();
  });
});
