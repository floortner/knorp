import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/lib/api';
import { reviewApi } from '@/lib/endpoints';
import type { QueueItem } from '@/lib/contract';
import { ReviewScreen } from './ReviewScreen';

vi.mock('@/lib/endpoints', () => ({
  reviewApi: { item: vi.fn(), claim: vi.fn(), submit: vi.fn(), release: vi.fn(), progress: vi.fn(), queue: vi.fn() },
}));

const open: QueueItem = {
  uploadId: 'u1',
  profileId: 'p1',
  name: 'Mia Muster',
  gradeBand: 'Einheit 3',
  skillTags: ['vowel_length'],
  imageUrl: 'https://example.test/u1.webp',
  llmAnalysis: {
    topic: 'Anlaute',
    exerciseType: 'fixvowel',
    items: [{ prompt: 'fahren', childAnswer: 'faren', correct: true, errorType: null }],
    suggestedFocus: ['vowel_length'],
  },
  createdAt: '2026-06-29T10:00:00.000Z',
  claimed: false,
  decision: null,
  reviewedAt: null,
  reviewedAnalysis: null,
  notes: null,
};

function renderReview() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/review/u1']}>
        <Routes>
          <Route path="/review/:uploadId" element={<ReviewScreen />} />
          <Route path="/queue" element={<p>Warteschlangen-Liste</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(reviewApi.claim).mockResolvedValue({ uploadId: 'u1', claimedUntil: '2026-06-29T10:15:00.000Z' });
  vi.mocked(reviewApi.release).mockResolvedValue({ ok: true });
  vi.mocked(reviewApi.submit).mockResolvedValue({ status: 'reviewed' });
});

describe('ReviewScreen', () => {
  it('claims on mount and submits an UNCHANGED draft as approved', async () => {
    vi.mocked(reviewApi.item).mockResolvedValue(open);
    const user = userEvent.setup();
    renderReview();
    expect(await screen.findByText('Mia Muster')).toBeInTheDocument();
    expect(reviewApi.claim).toHaveBeenCalledWith('u1');

    await user.click(screen.getByRole('button', { name: 'Bestätigen' }));
    expect(reviewApi.submit).toHaveBeenCalledWith('u1', {
      decision: 'approved',
      reviewedAnalysis: open.llmAnalysis,
      notes: undefined,
    });
    // Verdict done → straight back to the queue flow.
    expect(await screen.findByText('Warteschlangen-Liste')).toBeInTheDocument();
  });

  it('submits an EDITED draft as corrected (golden rule 3: dirty → corrected)', async () => {
    vi.mocked(reviewApi.item).mockResolvedValue(open);
    const user = userEvent.setup();
    renderReview();
    await screen.findByText('Mia Muster');

    // Flip the item verdict — the draft now differs from the LLM analysis.
    await user.click(screen.getByRole('button', { name: 'richtig' }));
    const submitBtn = await screen.findByRole('button', { name: 'Korrigiert übernehmen' });
    await user.click(submitBtn);

    expect(reviewApi.submit).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        decision: 'corrected',
        reviewedAnalysis: expect.objectContaining({
          items: [expect.objectContaining({ correct: false })],
        }),
      }),
    );
  });

  it('rejecting is confirm-gated and sends NO reviewedAnalysis (reject applies nothing)', async () => {
    vi.mocked(reviewApi.item).mockResolvedValue(open);
    const user = userEvent.setup();
    renderReview();
    await screen.findByText('Mia Muster');

    await user.click(screen.getByRole('button', { name: 'Ablehnen' }));
    expect(reviewApi.submit).not.toHaveBeenCalled(); // never one-tap
    await user.click(screen.getByRole('button', { name: 'Ja, ablehnen' }));
    expect(reviewApi.submit).toHaveBeenCalledWith('u1', { decision: 'rejected', notes: undefined });
  });

  it('a claim 409 renders the read-only banner and disables the verdict buttons', async () => {
    vi.mocked(reviewApi.item).mockResolvedValue(open);
    vi.mocked(reviewApi.claim).mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'Wird bereits von einer anderen Fachkraft geprüft.'),
    );
    renderReview();
    expect(await screen.findByText(/nur Ansicht/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bestätigen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ablehnen' })).toBeDisabled();
  });

  it('an already-decided deep link hands over to the read-only history detail, without claiming', async () => {
    vi.mocked(reviewApi.item).mockResolvedValue({
      ...open,
      decision: 'approved',
      reviewedAt: '2026-06-28T11:00:00.000Z',
      reviewedAnalysis: open.llmAnalysis,
    });
    renderReview();
    expect(await screen.findByText('Diese Hausübung wurde bereits geprüft.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zur erledigten Anfrage' })).toHaveAttribute('href', '/history/u1');
    expect(reviewApi.claim).not.toHaveBeenCalled();
  });
});
