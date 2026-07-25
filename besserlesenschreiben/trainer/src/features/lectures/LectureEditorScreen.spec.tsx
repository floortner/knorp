import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/lib/api';
import { lecturesApi } from '@/lib/endpoints';
import { LectureEditorScreen } from './LectureEditorScreen';

vi.mock('@/lib/endpoints', () => ({
  lecturesApi: { list: vi.fn(), create: vi.fn(), detail: vi.fn(), update: vi.fn(), remove: vi.fn(), publish: vi.fn(), unpublish: vi.fn(), assign: vi.fn(), assignments: vi.fn(), withdraw: vi.fn() },
}));

function renderNew() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/lectures/new']}>
        <Routes>
          <Route path="/lectures/new" element={<LectureEditorScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillValidLecture(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Titel'), 'Dehnungs-h');
  await user.type(screen.getByLabelText(/Merksatz/), 'Merke: Das h macht lang.');
  await user.type(screen.getByLabelText('Frage'), 'Welches Wort hat ein Dehnungs-h?');
  await user.type(screen.getByLabelText(/Antwortmöglichkeiten/), 'fahren\nfallen');
  await user.type(screen.getByLabelText('Richtige Antwort'), 'fahren');
}

beforeEach(() => vi.clearAllMocks());

describe('LectureEditorScreen', () => {
  it('saves a draft with the composed items and navigates to the detail', async () => {
    const user = userEvent.setup();
    vi.mocked(lecturesApi.create).mockResolvedValue({ lectureId: 'l9' } as never);
    renderNew();
    await fillValidLecture(user);
    await user.click(screen.getByRole('button', { name: 'Als Entwurf speichern' }));
    expect(lecturesApi.create).toHaveBeenCalledWith({
      title: 'Dehnungs-h',
      intro: 'Merke: Das h macht lang.',
      items: [
        expect.objectContaining({
          type: 'placeholder',
          prompt: 'Welches Wort hat ein Dehnungs-h?',
          options: ['fahren', 'fallen'],
          answer: 'fahren',
          skillTags: ['placeholder'],
        }),
      ],
    });
  });

  it('surfaces the server solvability 422 inline at the offending item', async () => {
    const user = userEvent.setup();
    vi.mocked(lecturesApi.create).mockRejectedValue(
      new ApiError(422, 'UNSOLVABLE_ITEM', 'Aufgabe ist nicht eindeutig lösbar.', undefined, [
        { field: 'items.0.answer', issue: 'answer "x" is not among options' },
      ]),
    );
    renderNew();
    await fillValidLecture(user);
    await user.click(screen.getByRole('button', { name: 'Als Entwurf speichern' }));
    expect(
      await screen.findByText('Die richtige Antwort muss eine der Antwortmöglichkeiten sein.'),
    ).toBeInTheDocument();
  });

  it('keeps saving disabled until title, Merksatz and a complete item exist', async () => {
    renderNew();
    expect(screen.getByRole('button', { name: 'Als Entwurf speichern' })).toBeDisabled();
  });
});
