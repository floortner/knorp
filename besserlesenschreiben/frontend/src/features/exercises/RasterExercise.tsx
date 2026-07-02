import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Exercise } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { ChoiceTile, ExerciseCard } from './ExerciseCard';
import { useAnswer } from './useAnswer';
import { BigWord } from './parts';

/**
 * Wortraster renderer (raster): decompose a monosyllable into Anfang · Vokal · Ende. The raster follows
 * the program's visual language — grey line for Anfang/Ende, the YELLOW circle ("die Sonne") for the
 * vowel in the middle. Tapped tiles fill the slots left to right; a full raster submits one attempt.
 */
export function RasterExercise({
  ex,
  onAttempt,
  onSolved,
  soundOn,
}: {
  ex: Extract<Exercise, { type: 'raster' }>;
  onAttempt: (given: string, isCorrect: boolean) => void;
  onSolved: () => void;
  soundOn: boolean;
}) {
  const { status, submit, reset } = useAnswer(ex, onAttempt, onSolved, soundOn);
  const [placed, setPlaced] = useState<number[]>([]); // indices into ex.tiles, slot order Anfang→Vokal→Ende

  const target = [ex.onset, ex.vowel, ex.coda];

  const place = (i: number) => {
    if (status === 'correct' || placed.includes(i) || placed.length === 3) return;
    const next = [...placed, i];
    setPlaced(next);
    if (next.length === 3) {
      const given = next.map((k) => ex.tiles[k]);
      submit(given.join('|'), given.every((part, slot) => part === target[slot]));
    }
  };

  const clear = () => {
    setPlaced([]);
    reset();
  };

  const slotValue = (slot: number) => (placed.length > slot ? ex.tiles[placed[slot]] : null);

  return (
    <ExerciseCard
      instruction="Zerlege das Wort: Anfang · Vokal · Ende. Der Selbstlaut kommt in die Sonne!"
      prompt={<BigWord>{ex.word}</BigWord>}
      status={status}
      praise={ex.praise}
    >
      <div className="space-y-5">
        {/* The Wortraster: line · yellow circle · line */}
        <div className="flex items-center justify-center gap-3">
          <RasterLine value={slotValue(0)} label="Anfang" />
          <div
            className={cn(
              'flex h-20 w-20 shrink-0 items-center justify-center rounded-full ring-4 transition',
              'bg-amber-300 ring-amber-400',
              slotValue(1) ? 'font-display text-2xl font-bold text-ink' : '',
            )}
            aria-label="Vokal"
          >
            {slotValue(1) ?? ''}
          </div>
          <RasterLine value={slotValue(2)} label="Ende" />
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {ex.tiles.map((t, i) => (
            <ChoiceTile
              key={i}
              label={t}
              state={placed.includes(i) ? 'selected' : 'idle'}
              disabled={status === 'correct' || placed.includes(i)}
              onClick={() => place(i)}
            />
          ))}
        </div>

        {status !== 'correct' && placed.length > 0 && (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={clear}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Nochmal
            </Button>
          </div>
        )}
      </div>
    </ExerciseCard>
  );
}

/** One of the raster's grey lines (Anfang/Ende): the placed part sits on the line. */
function RasterLine({ value, label }: { value: string | null; label: string }) {
  return (
    <div className="flex w-24 flex-col items-center gap-1" aria-label={label}>
      <span className="min-h-9 font-display text-2xl font-bold text-ink">{value ?? ''}</span>
      <span className="h-1 w-full rounded-full bg-ink/20" />
    </div>
  );
}
