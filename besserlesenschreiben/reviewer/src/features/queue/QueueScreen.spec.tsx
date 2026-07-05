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
  decision: null,
  reviewedAt: null,
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

  it('renders the Erledigt history with verdicts, read-only (no review link)', async () => {
    const done: QueueItem = { ...item, uploadId: 'u2', decision: 'corrected', reviewedAt: '2026-06-28T11:00:00.000Z' };
    vi.mocked(reviewApi.queue).mockResolvedValue({ items: [done], nextCursor: null, total: 1 });
    const user = userEvent.setup();
    renderQueue();
    await user.click(await screen.findByRole('tab', { name: 'Erledigt' }));
    expect(await screen.findByText(/Korrigiert/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull(); // history rows don't open the review screen
  });
});
