import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ChatHistory } from '@/lib/types';

const history: ChatHistory = {
  messages: [
    { me: true, text: '', ts: '2026-07-06T09:00:00Z', imageUrl: 'https://img.test/hw.webp' },
    {
      me: false,
      text: 'Deine Hausübung ist geprüft ✅ — Aufsatz. Toll gemacht! Neue Übungen warten auf dich!',
      ts: '2026-07-06T09:00:00Z',
      homeworkStatus: 'reviewed',
    },
    {
      me: false,
      text: 'Dein Foto ist da! Angelika passt deine nächsten Übungen an und meldet sich, wenn diese bereit sind.',
      ts: '2026-07-06T10:00:00Z',
      homeworkStatus: 'pending_review',
    },
  ],
};

vi.mock('@/lib/endpoints', () => ({
  chatApi: { history: () => Promise.resolve(history), send: vi.fn() },
  homeworkApi: { upload: vi.fn() },
}));
vi.mock('@/features/profile/useMe', () => ({
  useActiveProfile: () => ({ id: 'prof-1', name: 'Mia' }),
}));

// jsdom has no scrollIntoView (the chat auto-scrolls to the newest bubble).
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Imported after the mocks are registered.
const { Chat } = await import('./Chat');

function renderChat() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Chat homework status bubbles', () => {
  it('a REVIEWED verdict carries a CTA link to the Lernen tab (where the ✨ exercises live)', async () => {
    renderChat();
    const cta = await screen.findByRole('link', { name: /Zu deinen neuen Übungen/ });
    expect(cta).toHaveAttribute('href', '/app/lernen');
    expect(screen.getByText(/geprüft/)).toBeInTheDocument();
  });

  it('a PENDING upload shows the waiting text without a CTA', async () => {
    renderChat();
    await screen.findByText(/Dein Foto ist da/);
    // exactly ONE link — only the reviewed bubble gets the CTA
    expect(screen.getAllByRole('link', { name: /Zu deinen neuen Übungen/ })).toHaveLength(1);
  });
});
