import { type FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { staffAuthApi } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStaffAuth } from './auth-context';
import { AuthCard } from './AuthCard';

/** Step 2 of staff login: enter the one-time code. On success the backend sets the staff cookie. */
export function CodeScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useStaffAuth();
  const email = (location.state as { email?: string } | null)?.email ?? '';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await staffAuthApi.verify(email, code.trim());
      await login(); // refresh the /staff/me probe before navigating
      navigate('/queue', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Code ungültig oder abgelaufen.');
    } finally {
      setBusy(false);
    }
  }

  if (!email) {
    navigate('/login', { replace: true });
    return null;
  }

  return (
    <AuthCard title="Code eingeben" subtitle={`Gesendet an ${email}`}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label htmlFor="code" className="text-sm font-medium text-ink-soft">
          6-stelliger Code
        </label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" disabled={busy || !code.trim()}>
          {busy ? 'Prüfe …' : 'Anmelden'}
        </Button>
        <Button type="button" variant="link" onClick={() => navigate('/login')}>
          Andere E-Mail
        </Button>
      </form>
    </AuthCard>
  );
}
