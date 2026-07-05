import { describe, it, expect } from 'vitest';
import { leagueFor, nextStreak, isJokerAvailable, LEAGUE_GOLD, LEAGUE_SILBER } from './gamification';

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

describe('isJokerAvailable', () => {
  const now = new Date('2026-06-25T09:00:00Z'); // Thursday; week started Mon 2026-06-22

  it('is available when never used', () => {
    expect(isJokerAvailable(null, now)).toBe(true);
  });
  it('is not available when used this week (Monday)', () => {
    expect(isJokerAvailable(new Date('2026-06-22T00:00:00Z'), now)).toBe(false);
  });
  it('is available again when the stored date is from a previous week', () => {
    expect(isJokerAvailable(new Date('2026-06-15T00:00:00Z'), now)).toBe(true);
  });
});

describe('nextStreak', () => {
  const today = new Date('2026-06-25T09:00:00Z'); // Thursday; week Mon 2026-06-22
  const thisWeek = new Date('2026-06-22T00:00:00Z');
  const lastWeek = new Date('2026-06-15T00:00:00Z');

  it('starts a streak at 1 when there is no prior activity', () => {
    expect(nextStreak(null, today, 0, null)).toEqual({ streakDays: 1, jokerConsumed: false });
  });
  it('does not advance twice on the same day', () => {
    expect(nextStreak(new Date('2026-06-25T06:00:00Z'), today, 3, null)).toEqual({ streakDays: 3, jokerConsumed: false });
  });
  it('increments on a consecutive day', () => {
    expect(nextStreak(new Date('2026-06-24T20:00:00Z'), today, 3, null)).toEqual({ streakDays: 4, jokerConsumed: false });
  });
  it('resets to 1 after a gap of 2+ days when no joker is available', () => {
    expect(nextStreak(new Date('2026-06-22T20:00:00Z'), today, 9, thisWeek)).toEqual({ streakDays: 1, jokerConsumed: false });
  });

  // Joker: lastActive = Jun 23, today = Jun 25 → gap = 2 (1 missed day: Jun 24)
  it('uses an available joker for exactly one missed day and preserves the streak', () => {
    expect(nextStreak(new Date('2026-06-23T20:00:00Z'), today, 9, null)).toEqual({ streakDays: 10, jokerConsumed: true });
  });
  it('does not use the joker when it was already spent this week', () => {
    expect(nextStreak(new Date('2026-06-23T20:00:00Z'), today, 9, thisWeek)).toEqual({ streakDays: 1, jokerConsumed: false });
  });
  it('reuses the joker when the stored date is from a previous week', () => {
    expect(nextStreak(new Date('2026-06-23T20:00:00Z'), today, 9, lastWeek)).toEqual({ streakDays: 10, jokerConsumed: true });
  });
  it('does not apply the joker when two or more days were missed (gap ≥ 3)', () => {
    // lastActive = Jun 22, today = Jun 25 → gap = 3 (2 missed days)
    expect(nextStreak(new Date('2026-06-22T20:00:00Z'), today, 9, null)).toEqual({ streakDays: 1, jokerConsumed: false });
  });
});
