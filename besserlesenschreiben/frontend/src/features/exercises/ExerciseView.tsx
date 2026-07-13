import type { Exercise } from '@/lib/types';
import { BigWord } from './parts';
import { SingleChoiceExercise, type Choice } from './SingleChoiceExercise';

export interface ExerciseHandlers {
  onAttempt: (given: string, isCorrect: boolean) => void;
  onSolved: () => void;
  soundOn: boolean;
}

const strChoices = (opts: string[]): Choice[] => opts.map((o) => ({ key: o, label: o }));

/**
 * Renders the right interaction for an exercise's type. The Vokaltraining type set (14 types) was dropped
 * along with its word lists and sequence — training types are being redesigned from scratch. `placeholder`
 * is a stand-in single-choice type; grow this into a switch as new types are designed.
 */
export function ExerciseView({ ex, ...h }: { ex: Exercise } & ExerciseHandlers) {
  if (ex.type === 'placeholder') {
    return (
      <SingleChoiceExercise
        ex={ex}
        instruction="Tippe die richtige Antwort an!"
        prompt={<BigWord>{ex.prompt}</BigWord>}
        options={strChoices(ex.options)}
        correctKey={ex.answer}
        {...h}
      />
    );
  }
  // Unknown/forward-incompatible type from the backend: fail loudly so the lesson ErrorBoundary
  // shows its fallback instead of silently rendering nothing (the contract should prevent this).
  throw new Error(`Unhandled exercise type: ${(ex as { type?: string }).type ?? 'unknown'}`);
}
