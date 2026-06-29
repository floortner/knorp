import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setApiHandlers } from '@/lib/api';

/**
 * Wires the transport client's cross-cutting status handler to the router (ARCHITECTURE §5).
 * Rendered once inside the router. 401/SESSION_EXPIRED → go to /login once (the errored /staff/me
 * probe already flips auth state to anon, so no explicit logout call is needed).
 */
export function ApiErrorBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    setApiHandlers({
      onUnauthorized: () => {
        if (window.location.pathname !== '/login') navigate('/login', { replace: true });
      },
    });
    return () => setApiHandlers({});
  }, [navigate]);

  return null;
}
