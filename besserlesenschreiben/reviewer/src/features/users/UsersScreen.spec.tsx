import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UsersScreen } from './UsersScreen';
import { usersApi } from '@/lib/endpoints';
import type { AdminUser, StaffMe } from '@/lib/contract';

vi.mock('@/lib/endpoints', () => ({
  usersApi: { list: vi.fn(), approve: vi.fn(), deactivate: vi.fn(), remove: vi.fn() },
}));

let me: StaffMe = { reviewerId: 'r1', name: 'Owner', role: 'admin' };
vi.mock('@/features/auth/auth-context', () => ({ useStaffAuth: () => ({ reviewer: me }) }));

const pendingUser: AdminUser = {
  accountId: 'a1',
  email: 'family@example.com',
  status: 'pending',
  createdAt: '2026-06-20T10:00:00.000Z',
  profileCount: 0,
  lastActive: null,
};

function renderUsers() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <UsersScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  me = { reviewerId: 'r1', name: 'Owner', role: 'admin' };
});

describe('UsersScreen', () => {
  it('lists pending accounts with their real email and an approve action', async () => {
    vi.mocked(usersApi.list).mockResolvedValue({ items: [pendingUser], nextCursor: null, total: 1 });
    vi.mocked(usersApi.approve).mockResolvedValue({ accountId: 'a1', status: 'active' });
    const user = userEvent.setup();
    renderUsers();

    expect(await screen.findByText('family@example.com')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Freigeben' }));
    expect(usersApi.approve).toHaveBeenCalledWith('a1');
  });

  it('requires a confirm step before deleting', async () => {
    vi.mocked(usersApi.list).mockResolvedValue({ items: [pendingUser], nextCursor: null, total: 1 });
    vi.mocked(usersApi.remove).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderUsers();

    await screen.findByText('family@example.com');
    await user.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(usersApi.remove).not.toHaveBeenCalled(); // first click only arms the confirm
    await user.click(screen.getByRole('button', { name: 'Endgültig löschen' }));
    await waitFor(() => expect(usersApi.remove).toHaveBeenCalledWith('a1'));
  });

  it('hides the admin surface from a plain reviewer', async () => {
    me = { reviewerId: 'r2', name: 'Rev', role: 'reviewer' };
    renderUsers();
    expect(await screen.findByText(/Nur Administrator/)).toBeInTheDocument();
    expect(usersApi.list).not.toHaveBeenCalled();
  });
});
