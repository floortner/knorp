/**
 * Attempt timer that only counts time the page is actually visible (ROADMAP §J5.1). `timeMs` runs
 * from item mount to answer — without this, a backgrounded tab or a locked phone inflates it
 * unboundedly, and the backend's weak-skill heuristic reads "slow at this skill" out of a dinner
 * break. Backend aggregations additionally winsorize (60s cap) as the second line of defense.
 */
export interface ActiveTimer {
  /** Reset to zero and start counting (if the page is visible). Call on item mount. */
  restart(): void;
  /** Visible-time milliseconds since the last restart, rounded, never negative. */
  elapsedMs(): number;
  /** Remove the visibilitychange listener. Call on unmount. */
  dispose(): void;
}

/** The slice of Document the timer needs — injectable for deterministic tests. */
export interface VisibilityDoc {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export function createActiveTimer(
  now: () => number = () => performance.now(),
  doc: VisibilityDoc = document,
): ActiveTimer {
  let accumulated = 0;
  // Timestamp of the current visible stretch; null while the page is hidden.
  let since: number | null = doc.visibilityState === 'hidden' ? null : now();

  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') {
      if (since !== null) {
        accumulated += now() - since;
        since = null;
      }
    } else if (since === null) {
      since = now();
    }
  };
  doc.addEventListener('visibilitychange', onVisibility);

  return {
    restart() {
      accumulated = 0;
      since = doc.visibilityState === 'hidden' ? null : now();
    },
    elapsedMs() {
      return Math.max(0, Math.round(accumulated + (since !== null ? now() - since : 0)));
    },
    dispose() {
      doc.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
