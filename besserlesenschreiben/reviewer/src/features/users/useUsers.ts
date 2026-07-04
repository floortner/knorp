import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/endpoints';
import type { AccountStatus } from '@/lib/contract';

/**
 * Identity-bearing account list, filtered by lifecycle status (admin only; backend SPEC §6). `enabled`
 * lets the caller skip the fetch for a non-admin (the backend would 403 it anyway).
 */
export function useUsers(status?: AccountStatus, enabled = true) {
  return useQuery({
    queryKey: ['staff-users', status ?? 'all'],
    queryFn: () => usersApi.list({ status, limit: 100 }),
    enabled,
  });
}

/**
 * Count of accounts awaiting approval, for the nav badge. Keyed under the 'staff-users' prefix, so a
 * user-admin action (which invalidates ['staff-users']) refreshes the badge too.
 */
export function usePendingUserCount(enabled = true) {
  return useQuery({
    queryKey: ['staff-users', 'count', 'pending'],
    queryFn: () => usersApi.list({ status: 'pending', limit: 1 }),
    select: (r) => r.total,
    enabled,
  });
}

/** Per-child progress for one account (admin only). Lazy — pass `enabled` from the panel's open state. */
export function useUserProgress(accountId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['staff-user-progress', accountId],
    queryFn: () => usersApi.progress(accountId),
    enabled,
  });
}

/** approve / deactivate / delete — each refreshes every user list after it lands. */
export function useUserActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['staff-users'] });

  const approve = useMutation({ mutationFn: (id: string) => usersApi.approve(id), onSuccess: invalidate });
  const deactivate = useMutation({ mutationFn: (id: string) => usersApi.deactivate(id), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => usersApi.remove(id), onSuccess: invalidate });

  return { approve, deactivate, remove };
}
