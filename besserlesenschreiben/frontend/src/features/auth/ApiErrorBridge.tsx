import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setApiHandlers } from '@/lib/api';

/**
 * Wires the transport client's cross-cutting status handlers to the router (ARCHITECTURE §5).
 * Rendered once inside the router. 401/SESSION_EXPIRED → go to /login once (the errored /me probe
 * already flips auth state to anon, so no explicit logout call is needed); 402 → send the parent to
 * the supporter screen (never shown in child tabs).
 */
export function ApiErrorBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    setApiHandlers({
      onUnauthorized: () => {
        if (window.location.pathname !== '/login') navigate('/login', { replace: true });
      },
      onPaymentRequired: () => navigate('/parent'),
    });
    return () => setApiHandlers({});
  }, [navigate]);

  return null;
}
