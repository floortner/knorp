import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
