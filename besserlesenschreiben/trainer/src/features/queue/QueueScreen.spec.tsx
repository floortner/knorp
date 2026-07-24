import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QueueScreen } from './QueueScreen';
import { reviewApi } from '@/lib/endpoints';
import type { QueueItem } from '@/lib/contract';

vi.mock('@/lib/endpoints', () => ({ reviewApi: { queue: vi.fn() } }));

const item: QueueItem = {
  uploadId: 'u1',
  profileHandle: 'Lerner-4821',
  gradeBand: '1. Klasse',
  skillTags: ['vowel_length'],
  imageUrl: 'https://example.test/u1.webp',
  llmAnalysis: { topic: 'Anlaute', exerciseType: 'fixvowel', items: [], suggestedFocus: ['vowel_length'] },
  createdAt: '2026-06-29T10:00:00.000Z',
  claimed: false,
  decision: null,
  reviewedAt: null,
  reviewedAnalysis: null,
  notes: null,
};

function renderQueue() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <QueueScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('QueueScreen', () => {
  it('lists pending items by pseudonymous handle, never a name', async () => {
    vi.mocked(reviewApi.queue).mockResolvedValue({ items: [item], nextCursor: null, total: 1 });
    renderQueue();
    expect(await screen.findByText(/Lerner-4821/)).toBeInTheDocument();
    expect(screen.getByText(/Anlaute/)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/review/u1');
  });

  it('shows an empty state when the queue is clear', async () => {
    vi.mocked(reviewApi.queue).mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    renderQueue();
    expect(await screen.findByText(/Keine offenen Hausübungen/)).toBeInTheDocument();
  });

  it('renders a live-claimed row locked ("in Prüfung"), not clickable', async () => {
    vi.mocked(reviewApi.queue).mockResolvedValue({
      items: [{ ...item, claimed: true }],
      nextCursor: null,
      total: 1,
    });
    renderQueue();
    expect(await screen.findByText('in Prüfung')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull(); // someone else is on it — no way in from here
  });

  it('Erledigt rows carry the verdict and open the read-only history detail', async () => {
    const done: QueueItem = {
      ...item,
      uploadId: 'u2',
      decision: 'corrected',
      reviewedAt: '2026-06-28T11:00:00.000Z',
      reviewedAnalysis: item.llmAnalysis,
      notes: 'Gut gemacht!',
    };
    vi.mocked(reviewApi.queue).mockResolvedValue({ items: [done], nextCursor: null, total: 1 });
    const user = userEvent.setup();
    renderQueue();
    await user.click(await screen.findByRole('tab', { name: 'Erledigt' }));
    expect(await screen.findByText(/Korrigiert/)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/history/u2'); // read-only detail, never /review
  });

  it('offers "Mehr laden" when a next cursor exists and fetches the next page', async () => {
    vi.mocked(reviewApi.queue)
      .mockResolvedValueOnce({ items: [item], nextCursor: 'u1', total: 2 })
      .mockResolvedValueOnce({ items: [{ ...item, uploadId: 'u9' }], nextCursor: null, total: 2 });
    const user = userEvent.setup();
    renderQueue();
    await user.click(await screen.findByRole('button', { name: 'Mehr laden' }));
    expect(await screen.findAllByText(/Lerner-4821/)).toHaveLength(2);
    expect(vi.mocked(reviewApi.queue)).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'u1', status: 'open' }),
    );
    expect(screen.queryByRole('button', { name: 'Mehr laden' })).toBeNull(); // no further page
  });
});
