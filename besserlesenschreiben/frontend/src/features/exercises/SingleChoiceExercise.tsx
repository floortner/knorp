import { useState, type ReactNode } from 'react';
import type { Exercise } from '@/lib/types';
import { cn } from '@/lib/cn';
import { ChoiceTile, ExerciseCard } from './ExerciseCard';
import { useAnswer } from './useAnswer';

export interface Choice {
  key: string;
  label: ReactNode;
  /** Telemetry value when the key must be made unique (e.g. duplicate letters). Defaults to `key`. */
  value?: string;
}

/**
 * Single-choice renderer (findvowel, fixvowel, swapvowel, insertvowel, pickword, compound, family):
 * tap one option → correct/wrong. Either a single `correctKey`, or `correctKeys` when several options
 * are acceptable (swapvowel: more than one vowel makes a real word).
 */
export function SingleChoiceExercise({
  ex,
  instruction,
  prompt,
  options,
  correctKey,
  correctKeys,
  columns = 3,
  onAttempt,
  onSolved,
  soundOn,
}: {
  ex: Exercise;
  instruction: string;
  prompt?: ReactNode;
  options: Choice[];
  correctKey?: string;
  correctKeys?: string[];
  columns?: 2 | 3;
  onAttempt: (given: string, isCorrect: boolean) => void;
  onSolved: () => void;
  soundOn: boolean;
}) {
  const { status, submit } = useAnswer(ex, onAttempt, onSolved, soundOn);
  // The tapped option KEY (for tile highlighting) — `given` in useAnswer holds the telemetry value,
  // which differs from the key when options carry an explicit `value`.
  const [lastKey, setLastKey] = useState<string | null>(null);
  const accepted = correctKeys ?? (correctKey !== undefined ? [correctKey] : []);

  const tileState = (key: string) => {
    if (status === 'correct' && key === lastKey) return 'correct' as const;
    if (status === 'wrong' && key === lastKey) return 'wrong' as const;
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
            onClick={() => {
              setLastKey(o.key);
              submit(o.value ?? o.key, accepted.includes(o.key));
            }}
          />
        ))}
      </div>
    </ExerciseCard>
  );
}
