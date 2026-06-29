import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Exercise } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { ExerciseCard } from './ExerciseCard';
import { useAnswer } from './useAnswer';

/**
 * Build renderer: tap shuffled letter tiles to fill blank slots and spell the word shown as an
 * emoji. Tap a filled slot to return its tile. Auto-submits when all slots are filled.
 */
export function BuildExercise({
  ex,
  onAttempt,
  onSolved,
  soundOn,
}: {
  ex: Extract<Exercise, { type: 'build' }>;
  onAttempt: (given: string, isCorrect: boolean) => void;
  onSolved: () => void;
  soundOn: boolean;
}) {
  const { status, submit, reset } = useAnswer(ex, onAttempt, onSolved, soundOn);
  // Track which tile index occupies each slot (-1 = empty).
  const [slots, setSlots] = useState<number[]>(Array(ex.answer.length).fill(-1));

  const placed = new Set(slots.filter((s) => s !== -1));
  const nextEmpty = slots.indexOf(-1);

  const place = (tileIdx: number) => {
    if (status === 'correct' || placed.has(tileIdx) || nextEmpty === -1) return;
    const next = [...slots];
    next[nextEmpty] = tileIdx;
    setSlots(next);

    if (next.every((s) => s !== -1)) {
      const given = next.map((i) => ex.tiles[i]).join('');
      submit(given, given === ex.answer.join(''));
    }
  };

  const remove = (slotIdx: number) => {
    if (status === 'correct' || slots[slotIdx] === -1) return;
    const next = [...slots];
    next[slotIdx] = -1;
    setSlots(next);
  };

  const clear = () => {
    setSlots(Array(ex.answer.length).fill(-1));
    reset();
  };

  return (
    <ExerciseCard instruction="Buchstabiere das Wort!" status={status} praise={ex.praise}>
      <div className="space-y-5">
        <div className="flex justify-center text-6xl">{ex.emoji}</div>

        {/* Slots */}
        <div className="flex flex-wrap justify-center gap-2">
          {slots.map((tileIdx, i) => (
            <button
              key={i}
              type="button"
              onClick={() => remove(i)}
              disabled={status === 'correct' || tileIdx === -1}
              className={cn(
                'flex h-14 w-11 items-center justify-center rounded-xl font-display text-xl font-bold transition',
                tileIdx !== -1
                  ? status === 'correct'
                    ? 'bg-teal text-white shadow-sm'
                    : 'bg-teal-tint text-teal-dark shadow-sm ring-1 ring-teal/20 active:scale-95'
                  : 'border-2 border-dashed border-black/20',
              )}
            >
              {tileIdx !== -1 ? ex.tiles[tileIdx] : ''}
            </button>
          ))}
        </div>

        {/* Tile pool */}
        <div className="flex flex-wrap justify-center gap-2">
          {ex.tiles.map((tile, i) => (
            <button
              key={i}
              type="button"
              onClick={() => place(i)}
              disabled={status === 'correct' || placed.has(i)}
              className={cn(
                'flex h-14 w-11 items-center justify-center rounded-xl font-display text-xl font-bold shadow-sm ring-1 transition',
                placed.has(i)
                  ? 'bg-black/[0.04] text-transparent ring-black/5'
                  : 'bg-white text-ink ring-black/5 active:scale-95 hover:bg-black/[0.02]',
              )}
            >
              {tile}
            </button>
          ))}
        </div>

        {status !== 'correct' && placed.size > 0 && (
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
