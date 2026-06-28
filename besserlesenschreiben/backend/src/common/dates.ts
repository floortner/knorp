/**
 * Date helpers for FSRS scheduling and progress windows. All day/week bucketing is done in UTC so
 * results are deterministic and testable regardless of server timezone.
 */

const DAY_MS = 86_400_000;

/** Midnight (00:00:00.000) UTC of the day containing `d`. */
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** A Date `n` days before `now` (exact 24h multiples; used for "last N days" queries). */
export function daysAgo(now: Date, n: number): Date {
  return new Date(now.getTime() - n * DAY_MS);
}

/** Whole-day difference `b - a`, both floored to UTC midnight (e.g. yesterday→today = 1). */
export function utcDayDiff(a: Date, b: Date): number {
  return Math.round((startOfUtcDay(b).getTime() - startOfUtcDay(a).getTime()) / DAY_MS);
}

/** `YYYY-MM-DD` key for the UTC day of `d` (heatmap buckets). */
export function utcDateKey(d: Date): string {
  return startOfUtcDay(d).toISOString().slice(0, 10);
}

/** Monday 00:00 UTC of the ISO week containing `now` (the league's weekly star window). */
export function startOfUtcWeek(now: Date): Date {
  const day = startOfUtcDay(now);
  const mondayOffset = (day.getUTCDay() + 6) % 7; // Sun=0 → 6, Mon=1 → 0, …
  return new Date(day.getTime() - mondayOffset * DAY_MS);
}
