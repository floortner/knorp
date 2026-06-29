import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Exercise } from '@/lib/types';
import { cn } from '@/lib/cn';
import { ExerciseCard } from './ExerciseCard';
import { useAnswer } from './useAnswer';

/**
 * Swipe renderer: a large word card with two labelled tap targets (left / right) for binary
 * categorisation. Interaction is spatially distinct from all single-choice column grids.
 */
export function SwipeExercise({
  ex,
  onAttempt,
  onSolved,
  soundOn,
}: {
  ex: Extract<Exercise, { type: 'swipe' }>;
  onAttempt: (given: string, isCorrect: boolean) => void;
  onSolved: () => void;
  soundOn: boolean;
}) {
  const { status, given, submit } = useAnswer(ex, onAttempt, onSolved, soundOn);

  const tap = (side: 'left' | 'right') => {
    if (status === 'correct') return;
    submit(side, side === ex.answer);
  };

  const sideClass = (side: 'left' | 'right') =>
    cn(
      'flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl px-4 py-6 font-display text-lg font-bold shadow-sm ring-1 transition active:scale-[0.97]',
      status === 'correct' && given === side && 'bg-teal text-white ring-teal',
      status === 'wrong' && given === side && 'bg-orange/15 text-orange-dark ring-orange/40',
      status === 'correct' && given !== side && 'opacity-30',
      (status === 'idle' || (status === 'wrong' && given !== side)) &&
        'bg-white text-ink ring-black/5 hover:bg-black/[0.02]',
    );

  return (
    <ExerciseCard instruction="Wohin gehört das Wort?" status={status} praise={ex.praise}>
      <div className="space-y-5">
        <div className="flex items-center justify-center rounded-2xl bg-teal-tint px-8 py-6">
          <p className="font-display text-4xl font-bold text-ink">{ex.word}</p>
        </div>

        <div className="flex gap-3">
          <button type="button" className={sideClass('left')} onClick={() => tap('left')} disabled={status === 'correct'}>
            <ChevronLeft className="h-6 w-6" aria-hidden />
            {ex.leftLabel}
          </button>
          <button type="button" className={sideClass('right')} onClick={() => tap('right')} disabled={status === 'correct'}>
            <ChevronRight className="h-6 w-6" aria-hidden />
            {ex.rightLabel}
          </button>
        </div>
      </div>
    </ExerciseCard>
  );
}
