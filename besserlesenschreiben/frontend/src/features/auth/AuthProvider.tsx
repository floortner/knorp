import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { setAuthToken } from '@/lib/api';
import { AuthContext } from './auth-context';

/**
 * Holds the session token in memory only (SPEC §1 — no localStorage). A page refresh ends the
 * session until the backend's httpOnly-cookie / silent-refresh path lands; acceptable for the shell.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  const login = useCallback((next: string) => {
    setAuthToken(next);
    setToken(next);
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated: token !== null, login, logout }),
    [token, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
