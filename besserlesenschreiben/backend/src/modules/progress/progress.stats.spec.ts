import { describe, it, expect } from 'vitest';
import { weeklyActivity, monthlyHeatmap, skillBreakdown, type AttemptStat } from './progress.stats';

const now = new Date('2026-06-25T12:00:00Z'); // Thursday

function at(daysBack: number, skillTags: string[], isCorrect: boolean): AttemptStat {
  return { skillTags, isCorrect, createdAt: new Date(now.getTime() - daysBack * 86_400_000) };
}

describe('weeklyActivity', () => {
  // now = Thursday 2026-06-25 → current ISO week = Mon 2026-06-22 … Sun 2026-06-28.
  it('buckets the current ISO week Monday-first (Mo=0 … So=6)', () => {
    const out = weeklyActivity([at(0, ['x'], true), at(0, ['x'], true), at(3, ['x'], true)], now);
    expect(out).toHaveLength(7);
    expect(out).toEqual([1, 0, 0, 2, 0, 0, 0]); // Mon (3 days ago) = 1, Thu (today) = 2
  });

  it('ignores attempts from before this week (last Sunday and older)', () => {
    expect(weeklyActivity([at(4, ['x'], true), at(10, ['x'], true)], now)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('buckets by the student local day (Europe/Berlin), not UTC', () => {
    // Monday 21:15 UTC = 23:15 local (CEST) → still Monday for the student → Mo.
    const monNight: AttemptStat = { skillTags: ['x'], isCorrect: true, createdAt: new Date('2026-06-22T21:15:00Z') };
    expect(weeklyActivity([monNight], now)).toEqual([1, 0, 0, 0, 0, 0, 0]);
    // Monday 23:15 UTC = 01:15 local Tuesday → the student's Tuesday → Di, NOT Mo (the UTC-bucketing regression).
    const tueEarly: AttemptStat = { skillTags: ['x'], isCorrect: true, createdAt: new Date('2026-06-22T23:15:00Z') };
    expect(weeklyActivity([tueEarly], now)).toEqual([0, 1, 0, 0, 0, 0, 0]);
  });
});

describe('monthlyHeatmap', () => {
  it('returns 30 dated buckets ending today', () => {
    const out = monthlyHeatmap([at(0, ['x'], true)], now);
    expect(out).toHaveLength(30);
    expect(out[29]).toEqual({ date: '2026-06-25', count: 1 });
    expect(out[0].date).toBe('2026-05-27');
  });
});

describe('skillBreakdown', () => {
  it('rolls up attempts per skill with correct % and due flag, weakest first', () => {
    const attempts = [
      at(1, ['vowel_length'], false),
      at(1, ['vowel_length'], false),
      at(1, ['lexical_decision'], true),
    ];
    const out = skillBreakdown(attempts, new Set(['vowel_length']), now);
    expect(out[0]).toEqual({ skill: 'vowel_length', attempts: 2, correctPct: 0, due: true });
    expect(out[1]).toEqual({ skill: 'lexical_decision', attempts: 1, correctPct: 100, due: false });
  });
});
