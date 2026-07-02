import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Exercise } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ChoiceTile, ExerciseCard } from './ExerciseCard';
import { useAnswer } from './useAnswer';
import { BigWord } from './parts';

/**
 * Tile-order renderer (sylarrange): read the whole word, then rebuild it from its shuffled syllable
 * tiles — the program's "Ganzes → Silben → Ganzes" drill. The result is compared to `syll.join('|')`.
 * Reset clears a wrong attempt (SPEC §3).
 */
export function TileOrderExercise({
  ex,
  onAttempt,
  onSolved,
  soundOn,
}: {
  ex: Extract<Exercise, { type: 'sylarrange' }>;
  onAttempt: (given: string, isCorrect: boolean) => void;
  onSolved: () => void;
  soundOn: boolean;
}) {
  const target = ex.syll.join('|');
  const { status, submit, reset } = useAnswer(ex, onAttempt, onSolved, soundOn);
  const [order, setOrder] = useState<number[]>([]); // indices into ex.tiles

  const place = (i: number) => {
    if (status === 'correct' || order.includes(i)) return;
    const next = [...order, i];
    setOrder(next);
    if (next.length === ex.tiles.length) {
      const given = next.map((k) => ex.tiles[k]).join('|');
      submit(given, given === target);
    }
  };

  const clear = () => {
    setOrder([]);
    reset();
  };

  return (
    <ExerciseCard
      instruction="Lies das Wort und baue es aus den Silben nach. Sprich mit!"
      prompt={<BigWord>{ex.word}</BigWord>}
      status={status}
      praise={ex.praise}
    >
      <div className="space-y-4">
        <div className="flex min-h-14 flex-wrap items-center justify-center gap-2 rounded-2xl bg-black/[0.03] p-3">
          {order.length === 0 && <span className="text-sm text-ink-soft/60">…</span>}
          {order.map((k, pos) => (
            <span
              key={pos}
              className="rounded-xl bg-teal-tint px-3 py-2 font-display text-lg font-bold text-teal-dark"
            >
              {ex.tiles[k]}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {ex.tiles.map((t, i) => (
            <ChoiceTile
              key={i}
              label={t}
              state={order.includes(i) ? 'selected' : 'idle'}
              disabled={status === 'correct' || order.includes(i)}
              onClick={() => place(i)}
            />
          ))}
        </div>

        {status !== 'correct' && order.length > 0 && (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={clear}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Nochmal
            </Button>
          </div>
        )}
      </div>
    </ExerciseCard>
  );
}
