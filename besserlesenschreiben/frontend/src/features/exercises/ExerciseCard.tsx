import type { ReactNode } from 'react';
import type { AnswerStatus } from './useAnswer';
import { cn } from '@/lib/cn';

/** Shared exercise frame: an instruction, the prompt visual, the interactive control, and feedback. */
export function ExerciseCard({
  instruction,
  prompt,
  status,
  praise,
  children,
}: {
  instruction: string;
  prompt?: ReactNode;
  status: AnswerStatus;
  praise: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <p className="text-center font-medium text-ink-soft">{instruction}</p>
      {prompt && <div className="flex justify-center">{prompt}</div>}
      <div>{children}</div>

      <div className="min-h-12 text-center" aria-live="polite">
        {status === 'correct' && <p className="font-display font-bold text-teal-dark">{praise}</p>}
        {status === 'wrong' && <p className="font-display font-semibold text-orange-dark">Nochmal versuchen 💪</p>}
      </div>
    </section>
  );
}

/** A large tappable answer tile used by single-choice and pair/tile renderers. */
export function ChoiceTile({
  label,
  state,
  onClick,
  disabled,
}: {
  label: ReactNode;
  state?: 'correct' | 'wrong' | 'idle' | 'selected';
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid="choice-tile"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-14 items-center justify-center rounded-2xl px-4 py-3 font-display text-lg font-bold shadow-sm ring-1 transition active:scale-[0.98] disabled:active:scale-100',
        state === 'correct' && 'bg-teal text-white ring-teal',
        state === 'wrong' && 'bg-orange/15 text-orange-dark ring-orange/40',
        state === 'selected' && 'bg-teal-tint text-teal-dark ring-teal',
        (!state || state === 'idle') && 'bg-white text-ink ring-black/5 hover:bg-black/[0.02]',
      )}
    >
      {label}
    </button>
  );
}
