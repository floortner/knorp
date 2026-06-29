import type { Exercise } from '@/lib/types';
import { BigWord, Chips } from './parts';
import { SingleChoiceExercise, type Choice } from './SingleChoiceExercise';
import { TileOrderExercise } from './TileOrderExercise';
import { PairsExercise } from './PairsExercise';
import { SwipeExercise } from './SwipeExercise';
import { ListenExercise } from './ListenExercise';
import { SentenceExercise } from './SentenceExercise';
import { BuildExercise } from './BuildExercise';

export interface ExerciseHandlers {
  onAttempt: (given: string, isCorrect: boolean) => void;
  onSolved: () => void;
  soundOn: boolean;
}

const strChoices = (opts: string[]): Choice[] => opts.map((o) => ({ key: o, label: o }));

/** Renders the right interaction for an exercise's type, with its per-type prompt visual (SPEC §3). */
export function ExerciseView({ ex, ...h }: { ex: Exercise } & ExerciseHandlers) {
  switch (ex.type) {
    case 'count':
      return (
        <SingleChoiceExercise
          ex={ex}
          instruction="Wie viele Silben hat das Wort?"
          prompt={<BigWord>{ex.word}</BigWord>}
          options={ex.opts.map((n) => ({ key: String(n), label: String(n) }))}
          correctKey={String(ex.answer)}
          {...h}
        />
      );
    case 'gap':
      return (
        <SingleChoiceExercise
          ex={ex}
          instruction="Welche Silbe fehlt?"
          prompt={<Chips parts={ex.syll} gapIndex={ex.gapIndex} />}
          options={strChoices(ex.options)}
          correctKey={ex.answer}
          {...h}
        />
      );
    case 'rhyme':
      return (
        <SingleChoiceExercise
          ex={ex}
          instruction={`Was reimt sich auf „${ex.word}"?`}
          prompt={<BigWord>{ex.word}</BigWord>}
          options={strChoices(ex.options)}
          correctKey={ex.answer}
          {...h}
        />
      );
    case 'initial':
      return (
        <SingleChoiceExercise
          ex={ex}
          instruction="Womit beginnt das Wort?"
          prompt={<div className="space-y-2 text-center"><div className="text-6xl">{ex.emoji}</div><BigWord>{ex.word}</BigWord></div>}
          options={strChoices(ex.options)}
          correctKey={ex.answer}
          {...h}
        />
      );
    case 'letter':
      return (
        <SingleChoiceExercise
          ex={ex}
          instruction="Welcher Buchstabe fehlt?"
          prompt={<Chips parts={ex.letters} gapIndex={ex.gapIndex} />}
          options={strChoices(ex.options)}
          correctKey={ex.answer}
          {...h}
        />
      );
    case 'case':
      return (
        <SingleChoiceExercise
          ex={ex}
          instruction="Groß oder klein geschrieben?"
          prompt={ex.emoji ? <div className="text-6xl">{ex.emoji}</div> : undefined}
          options={strChoices(ex.options)}
          correctKey={ex.answer}
          columns={2}
          {...h}
        />
      );
    case 'nonsense':
      return (
        <SingleChoiceExercise
          ex={ex}
          instruction="Echtes Wort oder Quatschwort?"
          prompt={<BigWord>{ex.word}</BigWord>}
          options={strChoices(ex.options)}
          correctKey={ex.answer}
          columns={2}
          {...h}
        />
      );
    case 'bd':
      return (
        <SingleChoiceExercise
          ex={ex}
          instruction="Welcher Buchstabe ist das?"
          prompt={<span className="font-display text-7xl font-bold text-ink">{ex.glyph}</span>}
          options={strChoices(ex.options)}
          correctKey={ex.answer}
          {...h}
        />
      );
    case 'vowel':
      return (
        <SingleChoiceExercise
          ex={ex}
          instruction="Welche Buchstaben fehlen?"
          prompt={<Chips parts={ex.letters} gapIndex={ex.gapIndex} />}
          options={strChoices(ex.options)}
          correctKey={ex.answer}
          {...h}
        />
      );
    case 'order':
    case 'arrange':
      return <TileOrderExercise ex={ex} {...h} />;
    case 'pairs':
      return <PairsExercise ex={ex} {...h} />;
    case 'swipe':
      return <SwipeExercise ex={ex} {...h} />;
    case 'odd':
      return (
        <SingleChoiceExercise
          ex={ex}
          instruction={ex.instruction}
          options={ex.words.map((w) => ({ key: w, label: w }))}
          correctKey={ex.answer}
          columns={2}
          {...h}
        />
      );
    case 'listen':
      return <ListenExercise ex={ex} {...h} />;
    case 'sentence':
      return <SentenceExercise ex={ex} {...h} />;
    case 'build':
      return <BuildExercise ex={ex} {...h} />;
    default:
      // Unknown/forward-incompatible type from the backend: fail loudly so the lesson ErrorBoundary
      // shows its fallback instead of silently rendering nothing (the contract should prevent this).
      return assertNever(ex);
  }
}

function assertNever(ex: never): never {
  throw new Error(`Unhandled exercise type: ${(ex as { type?: string }).type ?? 'unknown'}`);
}
