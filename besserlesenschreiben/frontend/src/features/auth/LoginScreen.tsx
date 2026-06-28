import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/Logo';

export function LoginScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  const requestCode = useMutation({
    mutationFn: (value: string) => authApi.requestCode(value),
    onSuccess: () => navigate('/login/code', { state: { email } }),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim()) requestCode.mutate(email.trim());
  };

  return (
    <main className="bg-blobs flex min-h-dvh flex-col items-center px-6 py-10">
      <Logo className="mb-8" />

      <div className="flex aspect-square w-44 items-center justify-center rounded-full bg-teal-tint">
        <img src="/nepo.svg" alt="Nepo, dein Lernbuddy" className="w-28" />
      </div>

      <p className="mt-8 max-w-xs text-center text-lg text-ink-soft">
        Gib deine E-Mail ein – wir schicken dir einen 4-stelligen Code zum Anmelden. Kein Passwort nötig.
      </p>

      <form onSubmit={onSubmit} className="mt-6 w-full max-w-sm space-y-3">
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="hallo@besserlesenschreiben.at"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="E-Mail-Adresse"
        />
        {requestCode.isError && (
          <p role="alert" className="px-1 text-sm text-orange-dark">
            {(requestCode.error as ApiError).message}
          </p>
        )}
        <Button type="submit" size="lg" disabled={requestCode.isPending}>
          {requestCode.isPending ? 'Wird gesendet…' : 'Code per E-Mail senden'}
        </Button>
      </form>

      <Button variant="link" className="mt-5" onClick={() => navigate('/login/code', { state: { email } })}>
        Eltern-Zugang & Code-Login →
      </Button>

      <p className="mt-auto pt-8 text-center text-xs text-ink-soft/70">
        Mit der Anmeldung stimmst du den Nutzungsbedingungen und dem Datenschutz zu.
      </p>
    </main>
  );
}
