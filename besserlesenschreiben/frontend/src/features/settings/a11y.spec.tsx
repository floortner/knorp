import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Me } from '@/lib/types';

const me: Me = {
  account: { id: 'a1', email: 'm@test.de' },
  profiles: [
    {
      id: 'p1', name: 'Mia', buddy: 'nepo', goalPerWeek: 5, soundOn: false,
      dyslexicFont: true, fontScale: 1.5, stars: 0, streakDays: 0, unlockedUnit: 1,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],
};
vi.mock('@/lib/endpoints', () => ({ coreApi: { me: () => Promise.resolve(me) } }));

const { A11yProvider, useSoundOn } = await import('./a11y');

function SoundProbe() {
  return <span data-testid="sound">{String(useSoundOn())}</span>;
}

function renderProvider() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <A11yProvider>
        <SoundProbe />
      </A11yProvider>
    </QueryClientProvider>,
  );
}

describe('A11yProvider', () => {
  it('applies fontScale and the dyslexic flag from the active profile, and exposes soundOn', async () => {
    const { getByTestId } = renderProvider();
    await waitFor(() => expect(document.documentElement.style.fontSize).toBe('150%'));
    expect(document.documentElement.dataset.dyslexic).toBe('true');
    await waitFor(() => expect(getByTestId('sound').textContent).toBe('false'));
  });
});
