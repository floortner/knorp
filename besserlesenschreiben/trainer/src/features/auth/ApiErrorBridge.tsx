import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { setApiHandlers } from '@/lib/api';

/**
 * Wires the transport client's cross-cutting status handler to the router (ARCHITECTURE §5).
 * Rendered once inside the router. 401/SESSION_EXPIRED → clear auth AND go to /login once (AGENTS).
 * Dropping the cached me-probe matters when the 401 came from another call: the probe's staleTime
 * would otherwise keep the SPA "authenticated" with the cached identity for minutes.
 *
 * Clear via `setQueryData(..., null)` (the probe's "anonymous" value — useStaffMe), NEVER
 * `removeQueries`: removing detaches the mounted useStaffMe observer from the cache, login()'s
 * invalidate then refetches nothing, and every post-login screen hangs on "Lädt …".
 */
export function ApiErrorBridge() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    setApiHandlers({
      onUnauthorized: () => {
        qc.setQueryData(['staff-me'], null);
        if (window.location.pathname !== '/login') navigate('/login', { replace: true });
      },
    });
    return () => setApiHandlers({});
  }, [navigate, qc]);

  return null;
}
