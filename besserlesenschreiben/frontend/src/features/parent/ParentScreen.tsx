import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HeartHandshake } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Parent area placeholder (full milestone 8: PIN gate, trainer actions, supporter/billing). It exists
 * now so a 402 from a gated action has a parent-only landing spot — never surfaced in the child tabs.
 */
export function ParentScreen() {
  const navigate = useNavigate();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-8">
      <Button variant="link" className="self-start px-0" onClick={() => navigate('/app/lernen')}>
        <ArrowLeft className="h-4 w-4" aria-hidden /> Zurück zur App
      </Button>

      <div className="mt-10 flex flex-col items-center gap-3 rounded-card bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-tint text-teal-dark">
          <HeartHandshake className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="font-display text-xl font-bold text-ink">Eltern-Bereich</h1>
        <p className="text-ink-soft">
          PIN-Schutz, Trainer-Aktionen und der Unterstützer-Bereich folgen in Meilenstein 8.
        </p>
      </div>
    </main>
  );
}
