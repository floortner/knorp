import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';

/** Gate the app routes: wait for the session probe, then allow or redirect to /login (once). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isResolving } = useAuth();
  const location = useLocation();

  if (isResolving) {
    return <p className="py-20 text-center font-medium text-ink-soft">Lädt …</p>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
