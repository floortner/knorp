import { useState } from 'react';
import type { Exercise } from '@/lib/types';
import { cn } from '@/lib/cn';
import { ExerciseCard } from './ExerciseCard';
import { useAnswer } from './useAnswer';

/**
 * Sentence renderer: a full sentence is shown as tappable word tokens. Child taps the word
 * that satisfies the instruction (e.g. the noun, the word starting with a specific sound).
 */
export function SentenceExercise({
  ex,
  onAttempt,
  onSolved,
  soundOn,
}: {
  ex: Extract<Exercise, { type: 'sentence' }>;
  onAttempt: (given: string, isCorrect: boolean) => void;
  onSolved: () => void;
  soundOn: boolean;
}) {
  const { status, submit } = useAnswer(ex, onAttempt, onSolved, soundOn);
  // Track by index, not value, so duplicate tokens highlight independently.
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);

  const isPunct = (t: string) => /^[.,!?;:]$/.test(t);

  return (
    <ExerciseCard instruction={ex.instruction} status={status} praise={ex.praise}>
      <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-3 rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-black/5">
        {ex.tokens.map((token, i) => {
          if (isPunct(token)) {
            return (
              <span key={i} className="font-display text-2xl font-bold text-ink -ml-1.5">
                {token}
              </span>
            );
          }

          const isAnswer = token === ex.answer;
          const isWrong = i === wrongIdx;

          return (
            <button
              key={i}
              type="button"
              disabled={status === 'correct'}
              onClick={() => {
                if (!isAnswer) setWrongIdx(i);
                submit(token, isAnswer);
              }}
              className={cn(
                'rounded-xl px-3 py-1.5 font-display text-2xl font-bold transition active:scale-95',
                status === 'correct' && isAnswer && 'bg-teal text-white',
                status === 'wrong' && isWrong && 'bg-orange/15 text-orange-dark',
                status === 'correct' && !isAnswer && 'text-ink/40',
                status === 'idle' && 'text-ink hover:bg-teal-tint',
                status === 'wrong' && !isWrong && 'text-ink hover:bg-teal-tint',
              )}
            >
              {token}
            </button>
          );
        })}
      </div>
    </ExerciseCard>
  );
}
