import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStaffAuth } from './auth-context';

/** Gate the portal routes: wait for the staff session probe, then allow or redirect to /login (once). */
export function RequireStaff({ children }: { children: ReactNode }) {
  const { isAuthenticated, isResolving } = useStaffAuth();
  const location = useLocation();

  if (isResolving) {
    return <p className="py-20 text-center font-medium text-ink-soft">Lädt …</p>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
