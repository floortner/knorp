import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginScreen } from './LoginScreen';

function renderLogin() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LoginScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginScreen', () => {
  it('renders the email field and the send-code CTA', () => {
    renderLogin();
    expect(screen.getByLabelText('E-Mail-Adresse')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Code per E-Mail senden/i })).toBeInTheDocument();
  });
});
