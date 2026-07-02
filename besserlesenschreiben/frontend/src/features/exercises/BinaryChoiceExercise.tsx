import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Exercise } from '@/lib/types';
import { cn } from '@/lib/cn';
import { ExerciseCard } from './ExerciseCard';
import { useAnswer } from './useAnswer';

/**
 * Binary-choice renderer (realword, length, sylvalid, paircheck): a large prompt card with two labelled
 * tap targets. Interaction is spatially distinct from the single-choice column grids — the child sorts
 * the prompt to one of two sides (Echtes Wort / Quatschwort, kurz / lang, …).
 */
export function BinaryChoiceExercise({
  ex,
  instruction,
  prompt,
  left,
  right,
  correctKey,
  onAttempt,
  onSolved,
  soundOn,
}: {
  ex: Exercise;
  instruction: string;
  prompt: ReactNode;
  left: { key: string; label: string };
  right: { key: string; label: string };
  correctKey: string;
  onAttempt: (given: string, isCorrect: boolean) => void;
  onSolved: () => void;
  soundOn: boolean;
}) {
  const { status, given, submit } = useAnswer(ex, onAttempt, onSolved, soundOn);

  const tap = (choice: { key: string }) => {
    if (status === 'correct') return;
    submit(choice.key, choice.key === correctKey);
  };

  const sideClass = (key: string) =>
    cn(
      'flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl px-4 py-6 font-display text-lg font-bold shadow-sm ring-1 transition active:scale-[0.97]',
      status === 'correct' && given === key && 'bg-teal text-white ring-teal',
      status === 'wrong' && given === key && 'bg-orange/15 text-orange-dark ring-orange/40',
      status === 'correct' && given !== key && 'opacity-30',
      (status === 'idle' || (status === 'wrong' && given !== key)) &&
        'bg-white text-ink ring-black/5 hover:bg-black/[0.02]',
    );

  return (
    <ExerciseCard instruction={instruction} status={status} praise={ex.praise}>
      <div className="space-y-5">
        <div className="flex items-center justify-center rounded-2xl bg-teal-tint px-8 py-6">{prompt}</div>

        <div className="flex gap-3">
          <button type="button" className={sideClass(left.key)} onClick={() => tap(left)} disabled={status === 'correct'}>
            <ChevronLeft className="h-6 w-6" aria-hidden />
            {left.label}
          </button>
          <button type="button" className={sideClass(right.key)} onClick={() => tap(right)} disabled={status === 'correct'}>
            <ChevronRight className="h-6 w-6" aria-hidden />
            {right.label}
          </button>
        </div>
      </div>
    </ExerciseCard>
  );
}
