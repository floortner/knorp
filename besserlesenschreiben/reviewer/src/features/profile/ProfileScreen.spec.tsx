import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfileScreen } from './ProfileScreen';
import { staffAuthApi } from '@/lib/endpoints';
import type { StaffMe } from '@/lib/contract';

vi.mock('@/lib/endpoints', () => ({ staffAuthApi: { updateMe: vi.fn() } }));

const me: StaffMe = {
  reviewerId: 'r1',
  name: 'Dana',
  role: 'admin',
  email: 'dana@team.test',
  createdAt: '2026-01-05T00:00:00.000Z',
};
vi.mock('@/features/auth/auth-context', () => ({ useStaffAuth: () => ({ reviewer: me }) }));

function renderProfile() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ProfileScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('ProfileScreen', () => {
  it('shows the reviewer identity: name, login email, role and access date', () => {
    renderProfile();
    expect(screen.getByText('Dana')).toBeInTheDocument();
    expect(screen.getByText('dana@team.test')).toBeInTheDocument();
    expect(screen.getByText('Administrator:in')).toBeInTheDocument();
    expect(screen.getByText(/5\. Jänner 2026|5\. Januar 2026/)).toBeInTheDocument();
  });

  it('renames via PATCH /staff/me and updates the cached identity', async () => {
    vi.mocked(staffAuthApi.updateMe).mockResolvedValue({ ...me, name: 'Dana R.' });
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'Namen ändern' }));
    const input = screen.getByRole('textbox', { name: 'Anzeigename' });
    await user.clear(input);
    await user.type(input, 'Dana R.');
    await user.click(screen.getByRole('button', { name: 'Namen speichern' }));
    expect(staffAuthApi.updateMe).toHaveBeenCalledWith('Dana R.');
  });

  it('does not PATCH when the name is unchanged', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'Namen ändern' }));
    await user.click(screen.getByRole('button', { name: 'Namen speichern' }));
    expect(staffAuthApi.updateMe).not.toHaveBeenCalled();
  });
});
