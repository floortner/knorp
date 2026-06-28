import { useCallback, useState } from 'react';
import type { Exercise } from '@/lib/types';
import { buzz, chime, speak } from './audio';

export type AnswerStatus = 'idle' | 'wrong' | 'correct';

/**
 * Per-item answer state machine shared by every renderer (SPEC §3): idle → wrong (retry allowed) →
 * correct. Reports each tap to the runner via `onAttempt` (one telemetry row per attempt) and signals
 * `onSolved` once correct (chime + speak the word, then the runner advances).
 */
export function useAnswer(
  ex: Exercise,
  onAttempt: (given: string, isCorrect: boolean) => void,
  onSolved: () => void,
  soundOn: boolean,
) {
  const [status, setStatus] = useState<AnswerStatus>('idle');
  const [given, setGiven] = useState<string | null>(null);

  const submit = useCallback(
    (value: string, isCorrect: boolean) => {
      if (status === 'correct') return; // locked once solved
      setGiven(value);
      onAttempt(value, isCorrect);
      if (isCorrect) {
        setStatus('correct');
        chime(soundOn);
        speak(ex, soundOn);
        onSolved();
      } else {
        setStatus('wrong');
        buzz(soundOn);
      }
    },
    [status, onAttempt, onSolved, ex, soundOn],
  );

  /** Clear back to idle (tile-order / pairs "reset" after a wrong try). */
  const reset = useCallback(() => {
    if (status !== 'correct') {
      setStatus('idle');
      setGiven(null);
    }
  }, [status]);

  return { status, given, submit, reset };
}
