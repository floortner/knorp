import { startOfUtcWeek, utcDayDiff } from '../../common/dates';

/** Flat stars awarded for completing a session (matches the prototype's +15). */
export const STARS_PER_SESSION = 15;

/** Weekly-star thresholds for the league ladder. Gold at 300 matches the prototype's `starsToGold`. */
export const LEAGUE_SILBER = 100;
export const LEAGUE_GOLD = 300;

export interface League {
  tier: 'bronze' | 'silber' | 'gold';
  starsWeek: number;
  starsToNext: number;
}

/** League standing from the stars earned in the current week. */
export function leagueFor(starsWeek: number): League {
  if (starsWeek >= LEAGUE_GOLD) return { tier: 'gold', starsWeek, starsToNext: 0 };
  if (starsWeek >= LEAGUE_SILBER) return { tier: 'silber', starsWeek, starsToNext: LEAGUE_GOLD - starsWeek };
  return { tier: 'bronze', starsWeek, starsToNext: LEAGUE_SILBER - starsWeek };
}

/** True if the joker hasn't been used in the current ISO week (Monday–Sunday UTC). */
export function isJokerAvailable(jokerUsedWeek: Date | null, now: Date): boolean {
  if (!jokerUsedWeek) return true;
  return jokerUsedWeek.getTime() < startOfUtcWeek(now).getTime();
}

/**
 * Next streak value when a session completes.
 *   same UTC day  → unchanged
 *   consecutive   → +1
 *   1 missed day + joker available → +1, jokerConsumed = true
 *   gap > 1 or no joker → reset to 1
 */
export function nextStreak(
  lastActive: Date | null,
  now: Date,
  current: number,
  jokerUsedWeek: Date | null,
): { streakDays: number; jokerConsumed: boolean } {
  if (!lastActive) return { streakDays: 1, jokerConsumed: false };
  const gap = utcDayDiff(lastActive, now);
  if (gap <= 0) return { streakDays: current, jokerConsumed: false };
  if (gap === 1) return { streakDays: current + 1, jokerConsumed: false };
  if (gap === 2 && isJokerAvailable(jokerUsedWeek, now)) {
    return { streakDays: current + 1, jokerConsumed: true };
  }
  return { streakDays: 1, jokerConsumed: false };
}
