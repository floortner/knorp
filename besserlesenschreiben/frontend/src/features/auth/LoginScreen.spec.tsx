import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginScreen } from './LoginScreen';
import { authApi } from '@/lib/endpoints';

vi.mock('@/lib/endpoints', () => ({ authApi: { requestCode: vi.fn() } }));

function renderLogin() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LoginScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the email field and the send-code CTA', () => {
    renderLogin();
    expect(screen.getByLabelText('E-Mail-Adresse')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Code per E-Mail senden/i })).toBeInTheDocument();
  });

  it('shows the "email coming soon" state on submit and does NOT auto-advance to code entry', async () => {
    (authApi.requestCode as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('E-Mail-Adresse'), 'neu@example.com');
    await user.click(screen.getByRole('button', { name: /Code per E-Mail senden/i }));

    await waitFor(() => expect(screen.getByText(/Fast geschafft/i)).toBeInTheDocument());
    // Neutral, no-enumeration copy + an explicit (not automatic) path to code entry.
    expect(screen.getByText(/nicht sofort/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ich habe einen Code$/i })).toBeInTheDocument();
    expect(authApi.requestCode).toHaveBeenCalledWith('neu@example.com');
  });
});
