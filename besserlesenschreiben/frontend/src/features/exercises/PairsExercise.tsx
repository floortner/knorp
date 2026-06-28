import { useState } from 'react';
import type { Exercise } from '@/lib/types';
import { ChoiceTile, ExerciseCard } from './ExerciseCard';
import { useAnswer } from './useAnswer';

/**
 * Pair-match renderer (pairs): tap two tiles; correct if both belong to `pair` (SPEC §3).
 * A wrong pair clears the selection so the child can try again.
 */
export function PairsExercise({
  ex,
  onAttempt,
  onSolved,
  soundOn,
}: {
  ex: Extract<Exercise, { type: 'pairs' }>;
  onAttempt: (given: string, isCorrect: boolean) => void;
  onSolved: () => void;
  soundOn: boolean;
}) {
  const { status, submit, reset } = useAnswer(ex, onAttempt, onSolved, soundOn);
  const [picked, setPicked] = useState<string[]>([]);

  const tap = (tile: string) => {
    if (status === 'correct' || picked.includes(tile)) return;
    const next = [...picked, tile];
    if (next.length < 2) {
      setPicked(next);
      return;
    }
    const given = next.join('+');
    const isCorrect = next.every((t) => ex.pair.includes(t));
    setPicked(next);
    submit(given, isCorrect);
    if (!isCorrect) {
      // brief wrong flash, then clear for another try
      window.setTimeout(() => {
        setPicked([]);
        reset();
      }, 700);
    }
  };

  const stateOf = (tile: string) => {
    if (!picked.includes(tile)) return 'idle' as const;
    if (status === 'correct') return 'correct' as const;
    if (status === 'wrong') return 'wrong' as const;
    return 'selected' as const;
  };

  return (
    <ExerciseCard instruction="Finde die zwei Wörter, die sich reimen." status={status} praise={ex.praise}>
      <div className="grid grid-cols-2 gap-3">
        {ex.tiles.map((t) => (
          <ChoiceTile
            key={t}
            label={t}
            state={stateOf(t)}
            disabled={status === 'correct'}
            onClick={() => tap(t)}
          />
        ))}
      </div>
    </ExerciseCard>
  );
}
