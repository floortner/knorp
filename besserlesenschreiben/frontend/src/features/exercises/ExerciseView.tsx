import type { Exercise } from '@/lib/types';
import { BigWord, Chips } from './parts';
import { SingleChoiceExercise, type Choice } from './SingleChoiceExercise';
import { BinaryChoiceExercise } from './BinaryChoiceExercise';
import { TileOrderExercise } from './TileOrderExercise';
import { SentenceExercise } from './SentenceExercise';
import { RasterExercise } from './RasterExercise';

export interface ExerciseHandlers {
  onAttempt: (given: string, isCorrect: boolean) => void;
  onSolved: () => void;
  soundOn: boolean;
}

const strChoices = (opts: string[]): Choice[] => opts.map((o) => ({ key: o, label: o }));

/** Renders the right interaction for an exercise's type, with its per-type prompt visual (SPEC §3). */
export function ExerciseView({ ex, ...h }: { ex: Exercise } & ExerciseHandlers) {
  switch (ex.type) {
    case 'raster':
      return <RasterExercise ex={ex} {...h} />;
    case 'findvowel':
      return (
        <SingleChoiceExercise
          ex={ex}
          instruction="Wo steckt der Selbstlaut? Tippe ihn an!"
          prompt={<BigWord>{ex.word}</BigWord>}
          // Letters can repeat (Fell, Herr) — keys carry the index, telemetry gets the plain letter.
          options={ex.letters.map((l, i) => ({ key: `${i}:${l}`, label: l, value: l }))}
          correctKeys={ex.letters.map((l, i) => (l === ex.answer ? `${i}:${l}` : null)).filter((k): k is string => k !== null)}
          {...h}
        />
      );
    case 'realword':
      return (
        <BinaryChoiceExercise
          ex={ex}
          instruction="Echtes Wort oder Quatschwort? Lies laut vor!"
          prompt={<BigWord>{ex.word}</BigWord>}
          left={{ key: 'wort', label: 'Echtes Wort' }}
          right={{ key: 'quatsch', label: 'Quatschwort' }}
          correctKey={ex.answer}
          {...h}
        />
      );
    case 'fixvowel':
      return (
        <SingleChoiceExercise
          ex={ex}
          instruction={`Ersetze den Selbstlaut durch „${ex.vowel}" – welches echte Wort entsteht?`}
          prompt={<BigWord>{ex.pseudo}</BigWord>}
          options={strChoices(ex.options)}
          correctKey={ex.answer}
          {...h}
        />
      );
    case 'swapvowel':
      return (
        <SingleChoiceExercise
          ex={ex}
          instruction="Tausche den Selbstlaut – welcher macht ein neues echtes Wort?"
          prompt={<BigWord>{ex.word}</BigWord>}
          options={strChoices(ex.options)}
          correctKeys={ex.answers}
          {...h}
        />
      );
    case 'length':
      return (
        <BinaryChoiceExercise
          ex={ex}
          instruction={`Klingt „${ex.vowel}" hier kurz oder lang? Sprich laut vor!`}
          prompt={<BigWord>{ex.word}</BigWord>}
          left={{ key: 'kurz', label: 'Kurz' }}
          right={{ key: 'lang', label: 'Lang' }}
          correctKey={ex.answer}
          {...h}
        />
      );
    case 'sylvalid':
      return (
        <BinaryChoiceExercise
          ex={ex}
          instruction="Kann diese Silbe klingen? Sie braucht einen Selbstlaut!"
          prompt={<BigWord>{ex.syllable}</BigWord>}
          left={{ key: 'ja', label: 'Ja, sie klingt' }}
          right={{ key: 'nein', label: 'Nein' }}
          correctKey={ex.answer}
          {...h}
        />
      );
    case 'insertvowel':
      return (
        <SingleChoiceExercise
          ex={ex}
          instruction="Welcher Selbstlaut fehlt?"
          prompt={<BigWord>{ex.pattern}</BigWord>}
          options={strChoices(ex.options)}
          correctKey={ex.answer}
          {...h}
        />
      );
    case 'paircheck':
      return (
        <BinaryChoiceExercise
          ex={ex}
          instruction="Schau genau hin: Sind die beiden gleich?"
          prompt={<Chips parts={[ex.left, ex.right]} />}
          left={{ key: 'gleich', label: 'Gleich' }}
          right={{ key: 'anders', label: 'Anders' }}
          correctKey={ex.answer}
          {...h}
        />
      );
    case 'pickword':
      return (
        <SingleChoiceExercise
          ex={ex}
          instruction="Nur ein Wort ist echt. Tippe es an!"
          options={strChoices(ex.options)}
          correctKey={ex.answer}
          columns={2}
          {...h}
        />
      );
    case 'sentencefix':
      return <SentenceExercise ex={ex} {...h} />;
    case 'compound':
      return (
        <SingleChoiceExercise
          ex={ex}
          instruction="Der, die oder das? Der Artikel kommt vom letzten Teil!"
          prompt={
            <div className="space-y-2 text-center">
              <BigWord>{ex.word}</BigWord>
              <Chips parts={[ex.parts[0], ex.parts[1]]} />
            </div>
          }
          options={strChoices(ex.options)}
          correctKey={ex.answer}
          {...h}
        />
      );
    case 'family':
      return (
        <SingleChoiceExercise
          ex={ex}
          instruction={`Welches Wort gehört zur Familie „${ex.stem}"?`}
          options={strChoices(ex.options)}
          correctKey={ex.answer}
          {...h}
        />
      );
    case 'sylarrange':
      return <TileOrderExercise ex={ex} {...h} />;
    default:
      // Unknown/forward-incompatible type from the backend: fail loudly so the lesson ErrorBoundary
      // shows its fallback instead of silently rendering nothing (the contract should prevent this).
      return assertNever(ex);
  }
}

function assertNever(ex: never): never {
  throw new Error(`Unhandled exercise type: ${(ex as { type?: string }).type ?? 'unknown'}`);
}
