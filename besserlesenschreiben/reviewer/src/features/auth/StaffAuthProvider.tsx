import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { staffAuthApi } from '@/lib/endpoints';
import { StaffAuthContext } from './auth-context';
import { useStaffMe } from './useStaffMe';

/**
 * Cookie-session auth for the staff realm (ARCHITECTURE §1a, backend SPEC §6). The staff session JWT
 * lives in an httpOnly cookie the JS can't read, so auth state is derived from a `/staff/me` probe
 * (survives refresh). `login` refreshes it after verify; `logout` clears the cookie server-side.
 */
export function StaffAuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useStaffMe();
  const [signedOut, setSignedOut] = useState(false);

  const login = useCallback(async () => {
    setSignedOut(false);
    await qc.invalidateQueries({ queryKey: ['staff-me'] }); // awaits refetch → caller can navigate after
  }, [qc]);

  const logout = useCallback(async () => {
    try {
      await staffAuthApi.logout();
    } catch {
      /* clear locally regardless */
    }
    setSignedOut(true);
    // Clear the WHOLE cache, not just ['staff-me']: the reviewer holds real family emails, homework
    // image URLs, and queue data that must not linger after logout on a shared staff machine (P3).
    qc.clear();
  }, [qc]);

  const value = useMemo(
    () => ({
      isAuthenticated: !signedOut && me.isSuccess,
      isResolving: !signedOut && me.isPending,
      reviewer: signedOut ? null : (me.data ?? null),
      login,
      logout,
    }),
    [signedOut, me.isSuccess, me.isPending, me.data, login, logout],
  );

  return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>;
}
