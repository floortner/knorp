import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '@/features/profile/useMe';
import { authApi } from '@/lib/endpoints';
import { clearAttemptQueue } from '@/lib/telemetry';
import { AuthContext } from './auth-context';

// Runtime SW cache name — must match `cacheName` in vite.config.ts (security review P2-1/P2-2).
const API_CACHE = 'blsb-api';

/**
 * Erase per-user data held on the device beyond the httpOnly cookie: the SW runtime cache (units/progress)
 * and the queued telemetry (student answers). Without this, a shared/family device keeps the previous
 * student's data after logout, and queued attempts could flush under the next account's cookie.
 */
async function clearLocalUserData(): Promise<void> {
  clearAttemptQueue();
  try {
    if ('caches' in window) await caches.delete(API_CACHE);
  } catch {
    /* cache API unavailable / blocked — nothing to clear */
  }
}

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
    // Clear the WHOLE cache, not just ['me']: chat history and homework image URLs must not linger in
    // memory after logout on a shared/family device (security review P3).
    qc.clear();
    await clearLocalUserData();
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
