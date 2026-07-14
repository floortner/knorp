import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Me } from '@/lib/types';

const me: Me = {
  account: { id: 'a1', email: 'm@test.de' },
  profiles: [
    { id: 'p1', name: 'Mia', buddy: 'nepo', goalPerWeek: 5, soundOn: true, dyslexicFont: false, fontScale: 1, stars: 240, streakDays: 3, jokerAvailable: true, unlockedUnit: 1, createdAt: '2026-01-01T00:00:00Z' },
  ],
};

const verifyPin = vi.fn().mockResolvedValue({ parentToken: 'parent-token' });
const reset = vi.fn().mockResolvedValue({ ok: true });
const resetChat = vi.fn().mockResolvedValue({ ok: true });

vi.mock('@/lib/endpoints', () => ({
  coreApi: { me: () => Promise.resolve(me) },
  parentApi: {
    verifyPin: (pin: string, profileId: string) => verifyPin(pin, profileId),
    setPin: vi.fn(),
    unlockNext: vi.fn(),
    reset: (token: string) => reset(token),
    resetChat: (token: string) => resetChat(token),
  },
}));

const { ParentScreen } = await import('./ParentScreen');

function renderParent() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ParentScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Enter the PIN at the gate and wait for the parent home to appear. */
async function unlock(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByLabelText('PIN-Ziffer 1'));
  await user.keyboard('1234'); // focus auto-advances; the 4th digit auto-submits
  await screen.findByText('Einheiten');
}

beforeEach(() => {
  verifyPin.mockClear();
  reset.mockClear();
  resetChat.mockClear();
});

describe('ParentScreen', () => {
  it('gates on the PIN; a correct PIN binds the token to the child and opens the home', async () => {
    const user = userEvent.setup();
    renderParent();
    expect(await screen.findByText('Eltern-PIN eingeben um fortzufahren.')).toBeInTheDocument();
    await unlock(user);
    expect(verifyPin).toHaveBeenCalledWith('1234', 'p1');
    expect(screen.getByText('Lernfortschritt zurücksetzen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chat löschen' })).toBeInTheDocument();
  });

  it('deletes the chat only after confirmation, with the parent token, then re-locks to the gate', async () => {
    const user = userEvent.setup();
    renderParent();
    await unlock(user);

    await user.click(screen.getByRole('button', { name: 'Chat löschen' }));
    expect(resetChat).not.toHaveBeenCalled(); // confirm step first — never one-tap destructive
    await user.click(screen.getByRole('button', { name: 'Ja, Chat löschen' }));

    expect(resetChat).toHaveBeenCalledWith('parent-token');
    // destructive action done → back to the PIN gate (same as progress reset)
    expect(await screen.findByText('Eltern-PIN eingeben um fortzufahren.')).toBeInTheDocument();
  });

  it('Abbrechen cancels the chat-delete confirmation without calling the API', async () => {
    const user = userEvent.setup();
    renderParent();
    await unlock(user);

    await user.click(screen.getByRole('button', { name: 'Chat löschen' }));
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(resetChat).not.toHaveBeenCalled();
    expect(screen.queryByText('Wirklich den ganzen Chat löschen?')).not.toBeInTheDocument();
    expect(screen.getByText('Einheiten')).toBeInTheDocument(); // still unlocked — cancel is not destructive
  });

  it('resets learning progress only after confirmation, then re-locks to the gate', async () => {
    const user = userEvent.setup();
    renderParent();
    await unlock(user);

    await user.click(screen.getByRole('button', { name: 'Zurücksetzen' }));
    expect(reset).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Ja, zurücksetzen' }));

    expect(reset).toHaveBeenCalledWith('parent-token');
    expect(await screen.findByText('Eltern-PIN eingeben um fortzufahren.')).toBeInTheDocument();
  });
});
