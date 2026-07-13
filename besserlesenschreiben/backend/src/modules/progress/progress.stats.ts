import { daysAgo, startOfAppWeek, appDateKey, appDayDiff } from '../../common/dates';

/** One attempt reduced to what the progress aggregations need. */
export interface AttemptStat {
  skillTags: string[];
  isCorrect: boolean;
  createdAt: Date;
}

export interface HeatmapDay {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
}

export interface SkillStat {
  skill: string;
  attempts: number;
  correctPct: number; // 0..100, rounded
  due: boolean; // FSRS says this skill is due for review
}

/**
 * Attempts-per-day for the CURRENT ISO calendar week, Monday-first (index 0 = Mo … 6 = So), matching
 * the Mo–So week strip, the "diese Woche" goal ring, and the league's ISO-week window. Day boundaries
 * are the app's local timezone (Europe/Berlin), so a session at 01:15 local Tuesday counts as Tuesday —
 * the child's "today", not the UTC day (which would still be Monday and mis-credit the previous day).
 */
export function weeklyActivity(attempts: readonly AttemptStat[], now: Date): number[] {
  const monday = startOfAppWeek(now);
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const a of attempts) {
    const idx = appDayDiff(monday, a.createdAt);
    if (idx >= 0 && idx < 7) counts[idx] += 1;
  }
  return counts;
}

/** Attempts-per-day over the last 30 UTC days, oldest first. */
export function monthlyHeatmap(attempts: readonly AttemptStat[], now: Date): HeatmapDay[] {
  return dayBuckets(attempts, now, 30);
}

/**
 * Per-skill rollup over the supplied attempts: how many, first-pass-agnostic correct %, and whether
 * FSRS currently flags the skill as due. Sorted weakest-first so the UI can lead with what to drill.
 */
export function skillBreakdown(
  attempts: readonly AttemptStat[],
  dueSkills: ReadonlySet<string>,
  _now: Date,
): SkillStat[] {
  const agg = new Map<string, { n: number; correct: number }>();
  for (const a of attempts) {
    for (const tag of a.skillTags) {
      const cur = agg.get(tag) ?? { n: 0, correct: 0 };
      cur.n += 1;
      if (a.isCorrect) cur.correct += 1;
      agg.set(tag, cur);
    }
  }
  const out: SkillStat[] = [];
  for (const [skill, s] of agg) {
    out.push({
      skill,
      attempts: s.n,
      correctPct: Math.round((s.correct / s.n) * 100),
      due: dueSkills.has(skill),
    });
  }
  // weakest first (lowest correct %), then most-practised, then name for stable ordering
  return out.sort((a, b) => a.correctPct - b.correctPct || b.attempts - a.attempts || cmp(a.skill, b.skill));
}

function dayBuckets(attempts: readonly AttemptStat[], now: Date, days: number): HeatmapDay[] {
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) buckets.set(appDateKey(daysAgo(now, i)), 0);
  for (const a of attempts) {
    const key = appDateKey(a.createdAt);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
