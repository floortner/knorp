import { type ClipboardEvent, type KeyboardEvent, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { useAuth } from './auth-context';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/cn';

const LEN = 4;

export function CodeScreen() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const email = (useLocation().state as { email?: string } | null)?.email;
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''));
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const verify = useMutation({
    mutationFn: (code: string) => authApi.verify(email ?? '', code),
    onSuccess: async (res) => {
      await login(); // cookie is set by /auth/verify; refresh the session probe before navigating
      // New accounts set up their child profile first; existing users land on the home tab.
      navigate(res.isNewAccount ? '/onboarding' : '/app/lernen', { replace: true });
    },
  });

  // No email in nav state → start over (don't allow a dangling code screen).
  if (!email) return <Navigate to="/login" replace />;

  const code = digits.join('');

  const setAt = (i: number, value: string) => {
    const next = [...digits];
    next[i] = value;
    setDigits(next);
  };

  const onChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    setAt(i, digit);
    if (digit && i < LEN - 1) inputs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LEN);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(LEN).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputs.current[Math.min(pasted.length, LEN - 1)]?.focus();
  };

  return (
    <main className="bg-blobs flex min-h-dvh flex-col items-center px-6 py-10">
      <Logo className="mb-10" />

      <h1 className="font-display text-2xl font-bold text-ink">Code eingeben</h1>
      <p className="mt-3 max-w-xs text-center text-ink-soft">
        Wir haben einen 4-stelligen Code an <span className="font-semibold text-ink">{email}</span> geschickt.
      </p>

      <form
        className="mt-8 w-full max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === LEN) verify.mutate(code);
        }}
      >
        <div className="flex justify-center gap-3">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={d}
              onChange={(e) => onChange(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onPaste={onPaste}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              aria-label={`Ziffer ${i + 1}`}
              className={cn(
                'h-16 w-14 rounded-2xl bg-white text-center font-display text-3xl font-bold text-ink shadow-sm ring-1 ring-black/5',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60',
              )}
            />
          ))}
        </div>

        {verify.isError && (
          <p role="alert" className="mt-4 text-center text-sm text-orange-dark">
            {(verify.error as ApiError).message}
          </p>
        )}

        <Button type="submit" size="lg" className="mt-8" disabled={code.length !== LEN || verify.isPending}>
          {verify.isPending ? 'Wird geprüft…' : 'Anmelden'}
        </Button>
      </form>

      <Button variant="link" className="mt-5" onClick={() => navigate('/login')}>
        ← Andere E-Mail verwenden
      </Button>
    </main>
  );
}
