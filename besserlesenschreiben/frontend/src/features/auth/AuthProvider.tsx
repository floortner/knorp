import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '@/features/profile/useMe';
import { authApi } from '@/lib/endpoints';
import { AuthContext } from './auth-context';

/**
 * Cookie-session auth (SPEC §4): the session JWT lives in an httpOnly cookie the JS can't read, so
 * auth state is derived from a `/me` probe (survives refresh). `login` refreshes it after verify;
 * `logout` clears the cookie server-side. No token is held in JS.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useMe();
  const [signedOut, setSignedOut] = useState(false);

  const login = useCallback(async () => {
    setSignedOut(false);
    await qc.invalidateQueries({ queryKey: ['me'] }); // awaits the refetch → caller can navigate after
  }, [qc]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* clear locally regardless */
    }
    setSignedOut(true);
    qc.removeQueries({ queryKey: ['me'] });
  }, [qc]);

  const value = useMemo<{
    isAuthenticated: boolean;
    isResolving: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
  }>(
    () => ({
      isAuthenticated: !signedOut && me.isSuccess,
      isResolving: !signedOut && me.isPending,
      login,
      logout,
    }),
    [signedOut, me.isSuccess, me.isPending, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
