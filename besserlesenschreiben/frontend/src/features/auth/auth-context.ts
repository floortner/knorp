import { createContext, useContext } from 'react';

export interface AuthState {
  /** True once the /me probe confirms a valid session cookie. */
  isAuthenticated: boolean;
  /** True while the initial /me probe is in flight (avoid fl/redirect flicker). */
  isResolving: boolean;
  /** Refresh auth after a successful /auth/verify (the cookie is already set). */
  login: () => Promise<void>;
  /** Clear the session cookie and local auth state. */
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
