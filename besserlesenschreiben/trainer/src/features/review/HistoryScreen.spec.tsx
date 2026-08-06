import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { reviewApi } from '@/lib/endpoints';
import type { QueueItem } from '@/lib/contract';
import { HistoryScreen } from './HistoryScreen';

vi.mock('@/lib/endpoints', () => ({ reviewApi: { item: vi.fn() } }));

const decided: QueueItem = {
  uploadId: 'u2',
  profileId: 'p1',
  name: 'Mia Muster',
  gradeBand: 'Einheit 3',
  skillTags: ['vowel_length'],
  imageUrl: 'https://example.test/u2.webp',
  llmAnalysis: { topic: 'Anlaute', exerciseType: 'fixvowel', items: [], suggestedFocus: ['vowel_length'] },
  createdAt: '2026-06-29T10:00:00.000Z',
  claimed: false,
  decision: 'corrected',
  reviewedAt: '2026-06-30T09:00:00.000Z',
  reviewedAnalysis: { topic: 'Dehnungs-h', exerciseType: 'fixvowel', items: [], suggestedFocus: ['vowel_length'] },
  notes: 'Gut gemacht!',
};

function renderHistory(uploadId = 'u2') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/history/${uploadId}`]}>
        <Routes>
          <Route path="/history/:uploadId" element={<HistoryScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('HistoryScreen', () => {
  it('renders the decided review read-only: verdict chip, authoritative analysis, student comment', async () => {
    vi.mocked(reviewApi.item).mockResolvedValue(decided);
    renderHistory();
    expect(await screen.findByText('Mia Muster')).toBeInTheDocument();
    expect(screen.getByText('Korrigiert')).toBeInTheDocument();
    expect(screen.getByText('Übernommene Analyse')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Dehnungs-h')).toBeDisabled(); // the reviewed (not draft) topic, not editable
    expect(screen.getByText('Gut gemacht!')).toBeInTheDocument();
    // The name links into the learner profile (cross-link for the parent-conversation prep).
    expect(screen.getByRole('link', { name: 'Mia Muster' })).toHaveAttribute('href', '/students/p1');
  });

  it('a rejected review shows the LLM draft, clearly labeled as never applied', async () => {
    vi.mocked(reviewApi.item).mockResolvedValue({ ...decided, decision: 'rejected', reviewedAnalysis: null });
    renderHistory();
    expect(await screen.findByText('KI-Analyse (abgelehnt — nichts wurde übernommen)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Anlaute')).toBeDisabled(); // falls back to the draft
  });

  it('an item that is still OPEN is not a history entry', async () => {
    vi.mocked(reviewApi.item).mockResolvedValue({ ...decided, decision: null, reviewedAnalysis: null });
    renderHistory();
    expect(await screen.findByText('Diese erledigte Anfrage wurde nicht gefunden.')).toBeInTheDocument();
  });
});
