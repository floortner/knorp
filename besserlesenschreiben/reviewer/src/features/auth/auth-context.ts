import { createContext, useContext } from 'react';
import type { StaffMe } from '@/lib/contract';

export interface StaffAuthState {
  /** True once the /staff/me probe confirms a valid staff session cookie. */
  isAuthenticated: boolean;
  /** True while the initial /staff/me probe is in flight (avoid redirect flicker). */
  isResolving: boolean;
  /** The logged-in reviewer, once resolved. */
  reviewer: StaffMe | null;
  /** Refresh auth after a successful /staff/auth/verify (the cookie is already set). */
  login: () => Promise<void>;
  /** Clear the staff session cookie and local auth state. */
  logout: () => Promise<void>;
}

export const StaffAuthContext = createContext<StaffAuthState | null>(null);

export function useStaffAuth(): StaffAuthState {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) throw new Error('useStaffAuth must be used within <StaffAuthProvider>');
  return ctx;
}
