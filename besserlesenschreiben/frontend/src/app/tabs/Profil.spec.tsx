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

vi.mock('@/lib/endpoints', () => ({
  coreApi: {
    me: () => Promise.resolve(me),
    progress: () => Promise.resolve(progress),
    updateSettings: (id: string, body: unknown) => updateSettings(id, body),
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

beforeEach(() => updateSettings.mockClear());

describe('Profil', () => {
  it('shows the child header WITHOUT the machine-key skill diagnostics or a chat CTA', async () => {
    renderProfil();
    expect(await screen.findByText('Mia')).toBeInTheDocument();
    expect(screen.getByText(/aktiv seit/)).toBeInTheDocument();
    // diagnostics stay out of the child app (reviewer portal owns them); Chat is a bottom tab already
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
});
