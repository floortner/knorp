import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setApiHandlers } from '@/lib/api';
import { useAuth } from './auth-context';

/**
 * Wires the transport client's cross-cutting status handlers to router + auth (ARCHITECTURE §5).
 * Rendered once inside the router. 401/SESSION_EXPIRED → clear auth and go to /login (RequireAuth
 * prevents loops); 402 → send the parent to the supporter screen (never shown in child tabs).
 */
export function ApiErrorBridge() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setApiHandlers({
      onUnauthorized: () => {
        logout();
        if (window.location.pathname !== '/login') navigate('/login', { replace: true });
      },
      onPaymentRequired: () => navigate('/parent'),
    });
    return () => setApiHandlers({});
  }, [logout, navigate]);

  return null;
}
