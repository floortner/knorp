import { useEffect, useRef, useState } from 'react';
import type { SessionResponse } from '@/lib/types';
import { recordAttempt } from '@/lib/telemetry';
import { useSoundOn } from '@/features/settings/a11y';
import { useCompleteSession } from '@/features/sessions/useCompleteSession';
import { TOTAL_UNITS } from '@/lib/constants';
import { ExerciseView } from './ExerciseView';
import { LessonComplete } from './LessonComplete';
import { promptAndExpected } from './derive';

const ADVANCE_DELAY_MS = 900;

/**
 * Drives a session: renders one exercise at a time, emits exactly one telemetry attempt per answer
 * (timer from item mount, attemptNo per retry), advances on solve, and completes at the end (SPEC §3/§4).
 */
export function LessonRunner({ session }: { session: SessionResponse }) {
  const soundOn = useSoundOn();
  const complete = useCompleteSession();
  const items = session.items;
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const attemptNo = useRef(1);
  const startedAt = useRef(0);

  const ex = items[index];

  // Restart the timer + attempt counter whenever a new item becomes visible.
  useEffect(() => {
    startedAt.current = performance.now();
    attemptNo.current = 1;
  }, [index]);

  if (done || !ex) return (
    <LessonComplete
      result={complete.data}
      pending={complete.isPending}
      allUnitsComplete={session.unit === TOTAL_UNITS}
    />
  );

  const onAttempt = (given: string, isCorrect: boolean) => {
    const { prompt, expected } = promptAndExpected(ex);
    recordAttempt({
      sessionId: session.sessionId,
      itemId: ex.id,
      exerciseType: ex.type,
      prompt,
      expected,
      given,
      isCorrect,
      timeMs: Math.max(0, Math.round(performance.now() - startedAt.current)),
      attemptNo: attemptNo.current,
      skillTags: ex.skillTags,
    });
    if (!isCorrect) attemptNo.current += 1;
  };

  const onSolved = () => {
    window.setTimeout(() => {
      if (index + 1 < items.length) {
        setIndex((i) => i + 1);
      } else {
        setDone(true);
        complete.mutate(session.sessionId);
      }
    }, ADVANCE_DELAY_MS);
  };

  return (
    <div className="space-y-6 py-2">
      <ProgressBar index={index} total={items.length} />
      {/* key forces a fresh item state machine per exercise */}
      <ExerciseView key={ex.id} ex={ex} onAttempt={onAttempt} onSolved={onSolved} soundOn={soundOn} />
    </div>
  );
}

function ProgressBar({ index, total }: { index: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
        <span
          className="block h-full rounded-full bg-teal transition-all"
          style={{ width: `${(index / total) * 100}%` }}
        />
      </span>
      <span className="text-xs font-semibold text-ink-soft/70">
        {index + 1} / {total}
      </span>
    </div>
  );
}
