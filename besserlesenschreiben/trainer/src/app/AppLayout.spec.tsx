import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useStaffAuth } from '@/features/auth/auth-context';
import type { StaffMe } from '@/lib/contract';
import { AppLayout } from './AppLayout';

vi.mock('@/features/auth/auth-context', () => ({ useStaffAuth: vi.fn() }));
vi.mock('@/features/queue/useQueue', () => ({ useOpenRequestCount: () => ({ data: 3 }) }));
vi.mock('@/features/users/useUsers', () => ({ usePendingUserCount: () => ({ data: 2 }) }));

function trainer(role: StaffMe['role']): StaffMe {
  return { trainerId: 't1', name: 'Angelika', role, email: 'a@example.test', createdAt: '2026-01-01T00:00:00.000Z' };
}

function renderLayout(role: StaffMe['role']) {
  vi.mocked(useStaffAuth).mockReturnValue({
    isAuthenticated: true,
    isResolving: false,
    trainer: trainer(role),
    login: vi.fn(),
    logout: vi.fn(),
  });
  return render(
    <MemoryRouter>
      <AppLayout />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('AppLayout', () => {
  it('shows the admin-only Nutzer surface to an admin, with both nav badges', () => {
    renderLayout('admin');
    expect(screen.getByRole('link', { name: /Nutzer/ })).toHaveAttribute('href', '/users');
    expect(screen.getByText('3')).toBeInTheDocument(); // open homework requests
    expect(screen.getByText('2')).toBeInTheDocument(); // pending accounts
    expect(screen.getByText('· Admin')).toBeInTheDocument();
  });

  it('hides the Nutzer surface from a plain trainer (admin gate, rule 8)', () => {
    renderLayout('trainer');
    expect(screen.queryByRole('link', { name: /Nutzer/ })).toBeNull();
    expect(screen.queryByText('· Admin')).toBeNull();
    // The all-trainer surfaces stay reachable.
    expect(screen.getByRole('link', { name: /Chats/ })).toHaveAttribute('href', '/queue');
    expect(screen.getByRole('link', { name: /Lektionen/ })).toHaveAttribute('href', '/lectures');
    expect(screen.getByRole('link', { name: /Schüler/ })).toHaveAttribute('href', '/students');
    expect(screen.getByRole('link', { name: /Profil/ })).toHaveAttribute('href', '/profile');
  });
});
