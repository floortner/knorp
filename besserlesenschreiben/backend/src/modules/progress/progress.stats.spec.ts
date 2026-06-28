import { describe, it, expect } from 'vitest';
import { weeklyActivity, monthlyHeatmap, skillBreakdown, type AttemptStat } from './progress.stats';

const now = new Date('2026-06-25T12:00:00Z'); // Thursday

function at(daysBack: number, skillTags: string[], isCorrect: boolean): AttemptStat {
  return { skillTags, isCorrect, createdAt: new Date(now.getTime() - daysBack * 86_400_000) };
}

describe('weeklyActivity', () => {
  it('returns 7 day-buckets, today last', () => {
    const out = weeklyActivity([at(0, ['x'], true), at(0, ['x'], true), at(6, ['x'], true)], now);
    expect(out).toHaveLength(7);
    expect(out[6]).toBe(2); // today
    expect(out[0]).toBe(1); // 6 days ago
  });

  it('ignores attempts older than the window', () => {
    expect(weeklyActivity([at(10, ['x'], true)], now)).toEqual([0, 0, 0, 0, 0, 0, 0]);
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
      at(1, ['vowel_ie'], false),
      at(1, ['vowel_ie'], false),
      at(1, ['rhyme'], true),
    ];
    const out = skillBreakdown(attempts, new Set(['vowel_ie']), now);
    expect(out[0]).toEqual({ skill: 'vowel_ie', attempts: 2, correctPct: 0, due: true });
    expect(out[1]).toEqual({ skill: 'rhyme', attempts: 1, correctPct: 100, due: false });
  });
});
