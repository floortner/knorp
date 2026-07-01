import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { errorMessage } from '@/lib/api';
import type { Buddy } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { useCreateProfile } from './useCreateProfile';

const GOALS = [
  { value: 3, label: '3× pro Woche', hint: 'locker' },
  { value: 5, label: '5× pro Woche', hint: 'normal' },
  { value: 7, label: '7× pro Woche', hint: 'sportlich' },
];

const STEPS = 3;

export function OnboardingScreen() {
  const navigate = useNavigate();
  const createProfile = useCreateProfile();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [buddy, setBuddy] = useState<Buddy>('nepo');
  const [goal, setGoal] = useState(5);

  const finish = () => {
    createProfile.mutate(
      { name: name.trim() || 'Kind', buddy, goal },
      { onSuccess: () => navigate('/app/lernen', { replace: true }) },
    );
  };

  const next = () => (step < STEPS - 1 ? setStep((s) => s + 1) : finish());

  return (
    <main className="bg-blobs flex min-h-dvh flex-col px-6 py-8">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5" aria-label={`Schritt ${step + 1} von ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <span
              key={i}
              className={cn('h-1.5 rounded-full transition-all', i <= step ? 'w-6 bg-teal' : 'w-3 bg-black/10')}
            />
          ))}
        </div>
        {step < STEPS - 1 && (
          <Button variant="link" size="sm" className="text-ink-soft" onClick={finish}>
            Überspringen
          </Button>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {step === 0 && <Welcome buddy={buddy} />}
        {step === 1 && (
          <ChooseBuddy name={name} onName={setName} buddy={buddy} onBuddy={setBuddy} />
        )}
        {step === 2 && <ChooseGoal goal={goal} onGoal={setGoal} />}
      </div>

      {createProfile.isError && (
        <p role="alert" className="mb-3 text-center text-sm text-orange-dark">
          {errorMessage(createProfile.error)}
        </p>
      )}

      <div className="space-y-3">
        <Button
          size="lg"
          onClick={next}
          disabled={(step === 1 && !name.trim()) || createProfile.isPending}
        >
          {createProfile.isPending ? 'Wird angelegt…' : step < STEPS - 1 ? 'Weiter' : "Los geht's!"}
        </Button>
        {step > 0 && (
          <Button variant="link" className="w-full" onClick={() => setStep((s) => s - 1)} disabled={createProfile.isPending}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Zurück
          </Button>
        )}
      </div>
    </main>
  );
}

const BUDDY_META: Record<Buddy, { name: string; src: string }> = {
  nepo: { name: 'Nepo', src: '/nepo.svg' },
  stella: { name: 'Stella', src: '/stella.svg' },
};

function Welcome({ buddy }: { buddy: Buddy }) {
  const meta = BUDDY_META[buddy];
  return (
    <>
      <div className="flex aspect-square w-44 items-center justify-center rounded-full bg-teal-tint">
        <img src={meta.src} alt={meta.name} className="w-28" />
      </div>
      <h1 className="mt-6 font-display text-2xl font-bold text-ink">Hallo, ich bin {meta.name}!</h1>
      <p className="mt-3 max-w-xs text-ink-soft">
        Schön, dass du da bist. Gemeinsam üben wir Lesen &amp; Schreiben – Schritt für Schritt, in deinem Tempo.
      </p>
    </>
  );
}

function ChooseBuddy({
  name,
  onName,
  buddy,
  onBuddy,
}: {
  name: string;
  onName: (v: string) => void;
  buddy: Buddy;
  onBuddy: (b: Buddy) => void;
}) {
  return (
    <div className="w-full max-w-sm">
      <h1 className="font-display text-2xl font-bold text-ink">Wer übt mit?</h1>
      <p className="mt-2 text-ink-soft">Wähle deinen Namen und deinen Lernbuddy.</p>

      <Input
        className="mt-6"
        placeholder="Dein Name"
        value={name}
        onChange={(e) => onName(e.target.value)}
        aria-label="Name"
        maxLength={40}
        autoFocus
      />

      <div className="mt-5 grid grid-cols-2 gap-3">
        {(Object.keys(BUDDY_META) as Buddy[]).map((key) => {
          const meta = BUDDY_META[key];
          const selected = buddy === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onBuddy(key)}
              aria-pressed={selected}
              className={cn(
                'flex flex-col items-center gap-2 rounded-card bg-white p-4 shadow-sm ring-1 transition',
                selected ? 'ring-2 ring-teal' : 'ring-black/5',
              )}
            >
              <img src={meta.src} alt="" className="h-20" />
              <span className="font-display font-bold text-ink">{meta.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChooseGoal({ goal, onGoal }: { goal: number; onGoal: (g: number) => void }) {
  return (
    <div className="w-full max-w-sm">
      <h1 className="font-display text-2xl font-bold text-ink">Wie oft möchtest du üben?</h1>
      <p className="mt-2 text-ink-soft">Du kannst das später jederzeit ändern.</p>

      <div className="mt-6 space-y-3">
        {GOALS.map((g) => {
          const selected = goal === g.value;
          return (
            <button
              key={g.value}
              type="button"
              onClick={() => onGoal(g.value)}
              aria-pressed={selected}
              className={cn(
                'flex w-full items-center justify-between rounded-card bg-white p-4 text-left shadow-sm ring-1 transition',
                selected ? 'ring-2 ring-teal' : 'ring-black/5',
              )}
            >
              <span className="font-display font-bold text-ink">{g.label}</span>
              <span className="text-sm text-ink-soft">{g.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
