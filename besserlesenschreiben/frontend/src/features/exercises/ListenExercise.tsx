import { useEffect, useRef } from 'react';
import { Volume2 } from 'lucide-react';
import type { Exercise } from '@/lib/types';
import { speak } from './audio';
import { ChoiceTile, ExerciseCard } from './ExerciseCard';
import { useAnswer } from './useAnswer';

/**
 * Listen renderer: plays the word audio automatically on mount (word is hidden). The child
 * answers based purely on what they heard — no written word shown as a cue.
 */
export function ListenExercise({
  ex,
  onAttempt,
  onSolved,
  soundOn,
}: {
  ex: Extract<Exercise, { type: 'listen' }>;
  onAttempt: (given: string, isCorrect: boolean) => void;
  onSolved: () => void;
  soundOn: boolean;
}) {
  const { status, given, submit } = useAnswer(ex, onAttempt, onSolved, soundOn);
  const played = useRef(false);

  useEffect(() => {
    if (!played.current) {
      played.current = true;
      speak(ex, soundOn);
    }
  }, [ex, soundOn]);

  const tileState = (opt: string) => {
    if (status === 'correct' && opt === ex.answer) return 'correct' as const;
    if (status === 'wrong' && opt === given) return 'wrong' as const;
    return 'idle' as const;
  };

  return (
    <ExerciseCard instruction={ex.instruction} status={status} praise={ex.praise}>
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => speak(ex, soundOn)}
          className="mx-auto flex h-24 w-24 flex-col items-center justify-center gap-2 rounded-full bg-teal-tint text-teal-dark shadow-sm ring-1 ring-teal/20 transition active:scale-95 hover:bg-teal/10"
          aria-label="Nochmal anhören"
        >
          <Volume2 className="h-10 w-10" aria-hidden />
          <span className="text-xs font-semibold">Nochmal</span>
        </button>

        <div className="grid grid-cols-3 gap-3">
          {ex.options.map((opt) => (
            <ChoiceTile
              key={opt}
              label={opt}
              state={tileState(opt)}
              disabled={status === 'correct'}
              onClick={() => submit(opt, opt === ex.answer)}
            />
          ))}
        </div>
      </div>
    </ExerciseCard>
  );
}
