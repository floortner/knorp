import { utcDayDiff } from '../../common/dates';

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

/**
 * Next streak value when a session completes:
 *   already active today → unchanged · active yesterday → +1 · gap (or first ever) → reset to 1.
 */
export function nextStreak(lastActive: Date | null, now: Date, current: number): number {
  if (!lastActive) return 1;
  const gap = utcDayDiff(lastActive, now);
  if (gap <= 0) return current; // same UTC day, already counted
  if (gap === 1) return current + 1; // consecutive day
  return 1; // missed at least a day
}
