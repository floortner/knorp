import { describe, it, expect } from 'vitest';
import { leagueFor, nextStreak, LEAGUE_GOLD, LEAGUE_SILBER } from './gamification';

describe('leagueFor', () => {
  it('places a low weekly score in bronze with stars-to-silber', () => {
    expect(leagueFor(40)).toEqual({ tier: 'bronze', starsWeek: 40, starsToNext: LEAGUE_SILBER - 40 });
  });
  it('places a mid score in silber with stars-to-gold', () => {
    expect(leagueFor(120)).toEqual({ tier: 'silber', starsWeek: 120, starsToNext: LEAGUE_GOLD - 120 });
  });
  it('caps at gold with no next tier', () => {
    expect(leagueFor(320)).toEqual({ tier: 'gold', starsWeek: 320, starsToNext: 0 });
  });
});

describe('nextStreak', () => {
  const today = new Date('2026-06-25T09:00:00Z');

  it('starts a streak at 1 when there is no prior activity', () => {
    expect(nextStreak(null, today, 0)).toBe(1);
  });
  it('does not advance twice on the same day', () => {
    expect(nextStreak(new Date('2026-06-25T06:00:00Z'), today, 3)).toBe(3);
  });
  it('increments on a consecutive day', () => {
    expect(nextStreak(new Date('2026-06-24T20:00:00Z'), today, 3)).toBe(4);
  });
  it('resets to 1 after a gap', () => {
    expect(nextStreak(new Date('2026-06-22T20:00:00Z'), today, 9)).toBe(1);
  });
});
