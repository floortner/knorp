import { useEffect, useRef, useState } from 'react';
import type { SessionResponse } from '@/lib/types';
import { recordAttempt } from '@/lib/telemetry';
import { useSoundOn } from '@/features/settings/a11y';
import { useCompleteSession } from '@/features/sessions/useCompleteSession';
import { Button } from '@/components/ui/button';
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
  // Generated lectures open with a short teaching card (session.intro); bank sessions have none.
  const [showIntro, setShowIntro] = useState(Boolean(session.intro));
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
      // Backend-authoritative (SPEC §12): no more hardcoded unit count on the client.
      allUnitsComplete={complete.data?.allUnitsComplete ?? false}
    />
  );

  if (showIntro && session.intro) {
    return (
      <IntroCard
        text={session.intro}
        onStart={() => {
          // The first exercise becomes visible NOW — restart its timer so timeMs never
          // includes intro-reading time (telemetry invariant, SPEC §4).
          startedAt.current = performance.now();
          attemptNo.current = 1;
          setShowIntro(false);
        }}
      />
    );
  }

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

/** The lecture's teaching moment: mascot + Merksatz, dismissed by the child when ready. */
function IntroCard({ text, onStart }: { text: string; onStart: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 py-8 text-center">
      <img src="/nepo.svg" alt="" className="h-24 w-24" />
      <div className="max-w-sm rounded-card bg-teal-tint/70 p-5">
        <p className="font-display text-lg font-bold text-ink">{text}</p>
      </div>
      <Button size="lg" onClick={onStart}>
        Los geht's!
      </Button>
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
