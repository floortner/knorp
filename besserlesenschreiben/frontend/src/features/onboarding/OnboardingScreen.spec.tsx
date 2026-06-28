import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createProfile = vi.fn().mockResolvedValue({ profile: { id: 'p1' } });
vi.mock('@/lib/endpoints', () => ({ coreApi: { createProfile: (body: unknown) => createProfile(body) } }));

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

const { OnboardingScreen } = await import('./OnboardingScreen');

function renderOnboarding() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <OnboardingScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  createProfile.mockClear();
  navigate.mockClear();
});

describe('OnboardingScreen', () => {
  it('walks welcome → name+buddy → goal and POSTs the profile, then routes home', async () => {
    const user = userEvent.setup();
    renderOnboarding();

    expect(screen.getByRole('heading', { name: /Hallo, ich bin Nepo/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Weiter' }));

    await user.type(screen.getByLabelText('Name'), 'Mia');
    await user.click(screen.getByRole('button', { name: /Stella/i }));
    await user.click(screen.getByRole('button', { name: 'Weiter' }));

    await user.click(screen.getByRole('button', { name: /7× pro Woche/i }));
    await user.click(screen.getByRole('button', { name: /Los geht's/i }));

    await waitFor(() => expect(createProfile).toHaveBeenCalledWith({ name: 'Mia', buddy: 'stella', goal: 7 }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app/lernen', { replace: true }));
  });

  it('blocks advancing past the name step until a name is entered', async () => {
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(screen.getByRole('button', { name: 'Weiter' })); // → name step
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled();
  });
});
