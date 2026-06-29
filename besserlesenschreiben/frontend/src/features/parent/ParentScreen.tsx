import { type ClipboardEvent, type KeyboardEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Flame, RotateCcw, Star } from 'lucide-react';
import { parentApi } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { TOTAL_UNITS, buddySrc } from '@/lib/constants';
import { useMe } from '@/features/profile/useMe';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const LEN = 4;

type View = 'gate' | 'set-pin' | 'home';

// ─── Root ────────────────────────────────────────────────────────────────────

export function ParentScreen() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('gate');
  const [parentToken, setParentToken] = useState('');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-8">
      <Button variant="link" className="self-start px-0" onClick={() => navigate('/app/lernen')}>
        <ArrowLeft className="h-4 w-4" aria-hidden /> Zurück zur App
      </Button>

      <div className="mt-8 flex-1">
        {view === 'gate' && (
          <PinGate
            onSuccess={(token) => { setParentToken(token); setView('home'); }}
            onNoPin={() => setView('set-pin')}
          />
        )}
        {view === 'set-pin' && (
          <SetPin
            onSuccess={(token) => { setParentToken(token); setView('home'); }}
          />
        )}
        {view === 'home' && (
          <ParentHome parentToken={parentToken} onLock={() => setView('gate')} />
        )}
      </div>
    </main>
  );
}

// ─── PIN gate ────────────────────────────────────────────────────────────────

function PinGate({ onSuccess, onNoPin }: { onSuccess: (token: string) => void; onNoPin: () => void }) {
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''));
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const verify = useMutation({
    mutationFn: (pin: string) => parentApi.verifyPin(pin),
    onSuccess: (res) => onSuccess(res.parentToken),
    onError: (err: ApiError) => {
      if (err.code === 'CONFLICT') onNoPin();
    },
  });

  const pin = digits.join('');

  return (
    <section className="flex flex-col items-center gap-6 text-center">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-ink">Eltern-Bereich</h1>
        <p className="text-ink-soft">Eltern-PIN eingeben um fortzufahren.</p>
      </div>

      <PinInput
        digits={digits}
        inputsRef={inputs}
        onChange={setDigits}
        onComplete={(p) => verify.mutate(p)}
        disabled={verify.isPending}
      />

      {verify.isError && verify.error.code !== 'CONFLICT' && (
        <p role="alert" className="text-sm text-orange-dark">{verify.error.message}</p>
      )}

      <Button
        size="lg"
        className="w-full max-w-xs"
        disabled={pin.length !== LEN || verify.isPending}
        onClick={() => verify.mutate(pin)}
      >
        {verify.isPending ? 'Wird geprüft…' : 'Weiter'}
      </Button>
    </section>
  );
}

// ─── Set PIN (first time) ─────────────────────────────────────────────────────

function SetPin({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [first, setFirst] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''));
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const setPin = useMutation({ mutationFn: (pin: string) => parentApi.setPin(pin) });
  const verify = useMutation({
    mutationFn: (pin: string) => parentApi.verifyPin(pin),
    onSuccess: (res) => onSuccess(res.parentToken),
  });

  const pin = digits.join('');
  const isPending = setPin.isPending || verify.isPending;

  const onConfirm = async () => {
    if (pin !== first) {
      setDigits(Array(LEN).fill(''));
      inputs.current[0]?.focus();
      return;
    }
    await setPin.mutateAsync(pin);
    await verify.mutateAsync(pin);
  };

  const advance = (p: string) => {
    setFirst(p);
    setDigits(Array(LEN).fill(''));
    setStep('confirm');
    setTimeout(() => inputs.current[0]?.focus(), 50);
  };

  const mismatch = step === 'confirm' && pin.length === LEN && pin !== first && !isPending;

  return (
    <section className="flex flex-col items-center gap-6 text-center">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-ink">
          {step === 'enter' ? 'PIN festlegen' : 'PIN bestätigen'}
        </h1>
        <p className="text-ink-soft">
          {step === 'enter'
            ? 'Wähle einen 4-stelligen Eltern-PIN.'
            : 'Gib deinen PIN zur Bestätigung nochmals ein.'}
        </p>
      </div>

      <PinInput
        key={step}
        digits={digits}
        inputsRef={inputs}
        onChange={setDigits}
        onComplete={step === 'enter' ? advance : undefined}
        disabled={isPending}
      />

      {mismatch && <p role="alert" className="text-sm text-orange-dark">PINs stimmen nicht überein.</p>}
      {(setPin.isError || verify.isError) && (
        <p role="alert" className="text-sm text-orange-dark">
          {(setPin.error ?? verify.error as ApiError).message}
        </p>
      )}

      {step === 'confirm' && (
        <Button
          size="lg"
          className="w-full max-w-xs"
          disabled={pin.length !== LEN || isPending}
          onClick={onConfirm}
        >
          {isPending ? 'Wird gespeichert…' : 'PIN speichern'}
        </Button>
      )}
    </section>
  );
}

// ─── Parent home ──────────────────────────────────────────────────────────────

function ParentHome({ parentToken, onLock }: { parentToken: string; onLock: () => void }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const profile = me?.profiles[0];

  const reset = useMutation({
    mutationFn: () => parentApi.reset(profile!.id, parentToken),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['progress'] });
      void qc.invalidateQueries({ queryKey: ['units'] });
      setConfirming(false);
      onLock();
    },
  });

  if (!profile) return <p className="py-16 text-center text-ink-soft">Lädt …</p>;



  return (
    <section className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-ink">Eltern-Bereich</h1>

      {/* Child summary */}
      <div className="flex items-center gap-4 rounded-card bg-white p-4 shadow-sm ring-1 ring-black/5">
        <img src={buddySrc(profile.buddy)} alt="" className="h-16 w-16" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold text-ink">{profile.name}</p>
          <div className="mt-1 flex gap-4 text-sm font-semibold text-ink">
            <span className="flex items-center gap-1">
              <Flame className="h-4 w-4 text-orange" />{profile.streakDays} Tage
            </span>
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 text-amber-400" />{profile.stars} Sterne
            </span>
          </div>
        </div>
      </div>

      {/* Unit progress */}
      <div className="rounded-card bg-white p-4 shadow-sm ring-1 ring-black/5">
        <p className="mb-3 text-sm font-semibold text-ink">Einheiten</p>
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL_UNITS }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-2 flex-1 rounded-full',
                i < profile.unlockedUnit ? 'bg-teal' : 'bg-black/[0.06]',
              )}
              title={`Einheit ${i + 1}`}
            />
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          {profile.unlockedUnit} von {TOTAL_UNITS} Einheiten freigeschaltet
        </p>
      </div>

      {/* Reset */}
      <div className="rounded-card bg-white p-4 shadow-sm ring-1 ring-black/5">
        <p className="font-semibold text-ink">Lernfortschritt zurücksetzen</p>
        <p className="mt-1 text-sm text-ink-soft">
          Löscht alle Versuche, Übungsplan und Sterne. Name und Einstellungen bleiben erhalten.
        </p>

        {!confirming ? (
          <Button
            variant="ghost"
            className="mt-3 w-full text-orange-dark hover:bg-orange/10"
            onClick={() => setConfirming(true)}
          >
            <RotateCcw className="h-4 w-4" /> Zurücksetzen
          </Button>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-sm font-semibold text-orange-dark">Wirklich zurücksetzen?</p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setConfirming(false)}
                disabled={reset.isPending}
              >
                Abbrechen
              </Button>
              <Button
                className="flex-1 bg-orange-dark hover:bg-orange-dark/90"
                onClick={() => reset.mutate()}
                disabled={reset.isPending}
              >
                {reset.isPending ? 'Wird zurückgesetzt…' : 'Ja, zurücksetzen'}
              </Button>
            </div>
            {reset.isError && (
              <p role="alert" className="text-sm text-orange-dark">
                {(reset.error as ApiError).message}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Shared PIN input ─────────────────────────────────────────────────────────

function PinInput({
  digits,
  inputsRef,
  onChange,
  onComplete,
  disabled,
}: {
  digits: string[];
  inputsRef: React.MutableRefObject<Array<HTMLInputElement | null>>;
  onChange: (digits: string[]) => void;
  onComplete?: (pin: string) => void;
  disabled?: boolean;
}) {
  const update = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = digit;
    onChange(next);
    if (digit && i < LEN - 1) inputsRef.current[i + 1]?.focus();
    if (digit && i === LEN - 1) {
      const pin = next.join('');
      if (pin.length === LEN) onComplete?.(pin);
    }
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputsRef.current[i - 1]?.focus();
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LEN);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(LEN).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    onChange(next);
    inputsRef.current[Math.min(pasted.length, LEN - 1)]?.focus();
    if (pasted.length === LEN) onComplete?.(pasted);
  };

  return (
    <div className="flex justify-center gap-3">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          value={d}
          type="password"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          autoFocus={i === 0}
          aria-label={`PIN-Ziffer ${i + 1}`}
          onChange={(e) => update(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          className={cn(
            'h-16 w-14 rounded-2xl bg-white text-center font-display text-3xl font-bold text-ink shadow-sm ring-1 ring-black/5',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60',
            'disabled:opacity-50',
          )}
        />
      ))}
    </div>
  );
}
