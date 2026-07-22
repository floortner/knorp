import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Me, Progress } from '@/lib/types';
import { AuthProvider } from '@/features/auth/AuthProvider';

const me: Me = {
  account: { id: 'a1', email: 'm@test.de' },
  profiles: [
    { id: 'p1', name: 'Mia', buddy: 'nepo', goalPerWeek: 5, soundOn: true, dyslexicFont: false, fontScale: 1, stars: 240, streakDays: 3, jokerAvailable: true, unlockedUnit: 1, createdAt: '2026-01-01T00:00:00Z' },
  ],
};
const progress: Progress = {
  streakDays: 3, jokerAvailable: true, stars: 240, weeklyActivity: [0, 0, 0, 0, 0, 0, 1],
  monthlyHeatmap: [], league: { tier: 'bronze', starsWeek: 15, starsToNext: 85 },
  skillBreakdown: [{ skill: 'vowel_length', attempts: 3, correctPct: 100, due: false }],
};
const updateSettings = vi.fn().mockResolvedValue({ profile: me.profiles[0] });
const resetProgress = vi.fn().mockResolvedValue({ ok: true });
const resetChat = vi.fn().mockResolvedValue({ ok: true });

vi.mock('@/lib/endpoints', () => ({
  coreApi: {
    me: () => Promise.resolve(me),
    progress: () => Promise.resolve(progress),
    updateSettings: (id: string, body: unknown) => updateSettings(id, body),
    resetProgress: (id: string) => resetProgress(id),
    resetChat: (id: string) => resetChat(id),
  },
}));

const { Profil } = await import('./Profil');

function renderProfil() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <MemoryRouter>
          <Profil />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  updateSettings.mockClear();
  resetProgress.mockClear();
  resetChat.mockClear();
});

describe('Profil', () => {
  it('shows the student header WITHOUT the machine-key skill diagnostics or a chat CTA', async () => {
    renderProfil();
    expect(await screen.findByText('Mia')).toBeInTheDocument();
    expect(screen.getByText(/aktiv seit/)).toBeInTheDocument();
    // diagnostics stay out of the student app (reviewer portal owns them); Chat is a bottom tab already
    expect(screen.queryByText('vowel_length')).not.toBeInTheDocument();
    expect(screen.queryByText(/Trainerin kontaktieren/)).not.toBeInTheDocument();
  });

  it('shows the login email address', async () => {
    renderProfil();
    expect(await screen.findByText('m@test.de')).toBeInTheDocument();
  });

  it('edits the username and PATCHes { name }', async () => {
    const user = userEvent.setup();
    renderProfil();
    await user.click(await screen.findByRole('button', { name: 'Namen ändern' }));
    const input = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(input);
    await user.type(input, 'Max');
    await user.click(screen.getByRole('button', { name: 'Name speichern' }));
    expect(updateSettings).toHaveBeenCalledWith('p1', { name: 'Max' });
  });

  it('does not PATCH when the name is unchanged', async () => {
    const user = userEvent.setup();
    renderProfil();
    await user.click(await screen.findByRole('button', { name: 'Namen ändern' }));
    await user.click(screen.getByRole('button', { name: 'Name speichern' }));
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('toggles sound off via PATCH settings', async () => {
    const user = userEvent.setup();
    renderProfil();
    await user.click(await screen.findByRole('switch', { name: 'Ton an/aus' }));
    expect(updateSettings).toHaveBeenCalledWith('p1', { soundOn: false });
  });

  it('offers the 8 buddies; picking one PATCHes the profile', async () => {
    const user = userEvent.setup();
    renderProfil();
    await screen.findByText('Dein Lernfreund');
    expect(screen.getByRole('button', { name: 'Nepo' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Greta' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: 'Charly' }));
    expect(updateSettings).toHaveBeenCalledWith('p1', { buddy: 'charly' });
    // re-tapping the already-selected buddy does nothing
    await user.click(screen.getByRole('button', { name: 'Nepo' }));
    expect(updateSettings).toHaveBeenCalledTimes(1);
  });

  it('does not show a "Belohnungen" reward-pets section', async () => {
    renderProfil();
    await screen.findByText('Dein Lernfreund');
    expect(screen.queryByText('Belohnungen')).not.toBeInTheDocument();
    for (const pet of ['Bo', 'Echo', 'Inky', 'Pixel']) {
      expect(screen.queryByLabelText(`${pet} (noch gesperrt)`)).not.toBeInTheDocument();
    }
  });

  it('tapping the big buddy cycles its emotional reaction', async () => {
    const user = userEvent.setup();
    renderProfil();
    const buddyBtn = await screen.findByRole('button', { name: 'Dein Lernfreund reagiert' });
    const img = () => buddyBtn.querySelector('img')!.getAttribute('src');
    expect(img()).toBe('/monster-pets/nepo.svg'); // neutral base figure
    await user.click(buddyBtn);
    expect(img()).toBe('/monster-pets/nepo-froehlich.svg');
    await user.click(buddyBtn);
    expect(img()).toBe('/monster-pets/nepo-ueberrascht.svg');
    await user.click(buddyBtn);
    expect(img()).toBe('/monster-pets/nepo-cool.svg');
  });

  // NOTE: the Schriftgröße ("Groß") control was removed in milestone 1.6 (the font-scale stub was cut),
  // so there is no longer a font-scale PATCH from this screen — the test for it was removed with it.

  it('has no Eltern-Bereich CTA (the parent area + PIN were removed)', async () => {
    renderProfil();
    await screen.findByText('Verwaltung');
    expect(screen.queryByText('Eltern-Bereich')).not.toBeInTheDocument();
  });

  it('resets progress only after BOTH confirmation steps', async () => {
    const user = userEvent.setup();
    renderProfil();
    await user.click(await screen.findByRole('button', { name: /Zurücksetzen/ }));
    expect(screen.getByText('Wirklich zurücksetzen?')).toBeInTheDocument();
    expect(resetProgress).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(screen.getByText(/Bist du ganz sicher/)).toBeInTheDocument();
    expect(resetProgress).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Ja, endgültig zurücksetzen' }));
    expect(resetProgress).toHaveBeenCalledWith('p1');
  });

  it('a failed attempt\'s error is gone after Abbrechen → reopen (mutation state resets)', async () => {
    const user = userEvent.setup();
    resetProgress.mockRejectedValueOnce(new Error('offline'));
    renderProfil();
    await user.click(await screen.findByRole('button', { name: /Zurücksetzen/ }));
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    await user.click(screen.getByRole('button', { name: 'Ja, endgültig zurücksetzen' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await user.click(screen.getByRole('button', { name: /Zurücksetzen/ }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('Abbrechen at the final step aborts without calling the API', async () => {
    const user = userEvent.setup();
    renderProfil();
    await user.click(await screen.findByRole('button', { name: 'Chat löschen' }));
    expect(screen.getByText('Wirklich den ganzen Chat löschen?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(resetChat).not.toHaveBeenCalled();
    // back to the idle card — the action button is offered again
    expect(screen.getByRole('button', { name: 'Chat löschen' })).toBeInTheDocument();
  });

  it('deletes the chat after both confirmation steps', async () => {
    const user = userEvent.setup();
    renderProfil();
    await user.click(await screen.findByRole('button', { name: 'Chat löschen' }));
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    await user.click(screen.getByRole('button', { name: 'Ja, endgültig löschen' }));
    expect(resetChat).toHaveBeenCalledWith('p1');
  });
});
