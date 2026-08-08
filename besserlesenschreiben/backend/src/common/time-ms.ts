/**
 * Robust reading of attempt `time_ms` (ROADMAP §J5.1). The frontend timer pauses while the tab is
 * hidden, but historical rows and edge cases (device sleep mid-item, clock weirdness) can still
 * carry inflated values — and the weak-skill heuristic (>15 s avg) and the digest's „Ø Zeit" read a
 * single dinner-break outlier as "slow at this skill". Every aggregation over time_ms MUST go
 * through this cap; raw values stay untouched in the `attempt` rows (per-question drill-downs show
 * the truth, aggregates read it robustly — ARCHITECTURE §12).
 */
export const TIME_MS_CAP = 60_000;

/** Clamp one attempt duration to [0, TIME_MS_CAP] before it enters any mean/sum. */
export function winsorizeMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.min(ms, TIME_MS_CAP);
}
