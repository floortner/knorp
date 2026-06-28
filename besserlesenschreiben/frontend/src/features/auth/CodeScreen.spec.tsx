import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CodeScreen } from './CodeScreen';
import { AuthContext, type AuthState } from './auth-context';

const verify = vi.fn();
vi.mock('@/lib/endpoints', () => ({ authApi: { verify: (...a: unknown[]) => verify(...a) } }));

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>;
}

function renderAt(email: string | undefined, auth: Partial<AuthState> = {}) {
  const value: AuthState = {
    isAuthenticated: false,
    isResolving: false,
    login: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    ...auth,
  };
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={value}>
        <MemoryRouter initialEntries={[{ pathname: '/login/code', state: email ? { email } : null }]}>
          <Routes>
            <Route path="/login/code" element={<CodeScreen />} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return value;
}

async function typeCode(user: ReturnType<typeof userEvent.setup>, code: string) {
  const boxes = screen.getAllByRole('textbox');
  for (let i = 0; i < code.length; i++) await user.type(boxes[i], code[i]);
}

describe('CodeScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects to /login when no email is in nav state', () => {
    renderAt(undefined);
    expect(screen.getByTestId('loc')).toHaveTextContent('/login');
  });

  it('verifies, refreshes auth, then routes a returning user to /app/lernen', async () => {
    const user = userEvent.setup();
    verify.mockResolvedValue({ isNewAccount: false });
    const { login } = renderAt('kid@home.de');
    await typeCode(user, '1234');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));
    expect(verify).toHaveBeenCalledWith('kid@home.de', '1234');
    expect(login).toHaveBeenCalledOnce();
    expect(await screen.findByTestId('loc')).toHaveTextContent('/app/lernen');
  });

  it('routes a new account to /onboarding', async () => {
    const user = userEvent.setup();
    verify.mockResolvedValue({ isNewAccount: true });
    renderAt('new@home.de');
    await typeCode(user, '5678');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));
    expect(await screen.findByTestId('loc')).toHaveTextContent('/onboarding');
  });
});
