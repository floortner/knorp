import { createContext, useContext } from 'react';

export interface AuthState {
  isAuthenticated: boolean;
  /** Set after a successful /auth/verify. */
  login: (token: string) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
