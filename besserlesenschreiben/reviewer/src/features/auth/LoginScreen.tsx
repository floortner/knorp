import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { staffAuthApi } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthCard } from './AuthCard';

/** Step 1 of staff login: request a one-time code by email. The backend always 200s (no enumeration). */
export function LoginScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await staffAuthApi.requestCode(email.trim());
      navigate('/login/code', { state: { email: email.trim() } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Etwas ist schiefgelaufen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Review-Portal" subtitle="Anmeldung für Fachkräfte">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-sm font-medium text-ink-soft">
          Dienstliche E-Mail
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@team.example"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" disabled={busy || !email.trim()}>
          {busy ? 'Sende Code …' : 'Code anfordern'}
        </Button>
      </form>
    </AuthCard>
  );
}
