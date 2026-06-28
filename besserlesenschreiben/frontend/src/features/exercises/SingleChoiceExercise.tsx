import type { ReactNode } from 'react';
import type { Exercise } from '@/lib/types';
import { cn } from '@/lib/cn';
import { ChoiceTile, ExerciseCard } from './ExerciseCard';
import { useAnswer } from './useAnswer';

export interface Choice {
  key: string;
  label: ReactNode;
}

/**
 * Single-choice renderer (count, gap, rhyme, initial, letter, case, nonsense, bd, vowel): tap one
 * option → correct/wrong. `correctKey` is the answer stringified to match an option's `key`.
 */
export function SingleChoiceExercise({
  ex,
  instruction,
  prompt,
  options,
  correctKey,
  columns = 3,
  onAttempt,
  onSolved,
  soundOn,
}: {
  ex: Exercise;
  instruction: string;
  prompt?: ReactNode;
  options: Choice[];
  correctKey: string;
  columns?: 2 | 3;
  onAttempt: (given: string, isCorrect: boolean) => void;
  onSolved: () => void;
  soundOn: boolean;
}) {
  const { status, given, submit } = useAnswer(ex, onAttempt, onSolved, soundOn);

  const tileState = (key: string) => {
    if (status === 'correct' && key === correctKey) return 'correct' as const;
    if (status === 'wrong' && key === given) return 'wrong' as const;
    return 'idle' as const;
  };

  return (
    <ExerciseCard instruction={instruction} prompt={prompt} status={status} praise={ex.praise}>
      <div className={cn('grid gap-3', columns === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
        {options.map((o) => (
          <ChoiceTile
            key={o.key}
            label={o.label}
            state={tileState(o.key)}
            disabled={status === 'correct'}
            onClick={() => submit(o.key, o.key === correctKey)}
          />
        ))}
      </div>
    </ExerciseCard>
  );
}
