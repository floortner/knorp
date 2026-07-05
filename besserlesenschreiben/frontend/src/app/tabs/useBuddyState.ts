import { useEffect, useRef } from 'react';
import type { Progress } from '@/lib/types';
import type { BuddyState } from '@/lib/constants';

const UNIT_KEY = 'blsb.unlockedUnit';

/**
 * Derives the buddy's emotional state from live progress data.
 * Priority: ueberrascht (unit just unlocked) > froehlich (practiced today)
 *           > traurig (2+ day absence) > cool (default).
 *
 * Unit-unlock detection: compares profile.unlockedUnit against a sessionStorage
 * snapshot written on every visit, so a bump is detected exactly once.
 */
export function useBuddyState(
  unlockedUnit: number | undefined,
  progress: Progress | undefined,
): BuddyState {
  // Evaluated once per mount, before the useEffect persists the new unit value.
  const justUnlocked = useRef<boolean | undefined>(undefined);
  if (justUnlocked.current === undefined && unlockedUnit !== undefined) {
    const stored = Number(sessionStorage.getItem(UNIT_KEY) ?? '0');
    justUnlocked.current = stored > 0 && unlockedUnit > stored;
  }

  useEffect(() => {
    if (unlockedUnit !== undefined) {
      sessionStorage.setItem(UNIT_KEY, String(unlockedUnit));
    }
  }, [unlockedUnit]);

  if (justUnlocked.current) return 'ueberrascht';

  if (progress) {
    const today = new Date().toISOString().slice(0, 10);
    if (progress.monthlyHeatmap.some((e) => e.date === today && e.count > 0)) return 'froehlich';

    const sorted = progress.monthlyHeatmap
      .filter((e) => e.count > 0)
      .map((e) => e.date)
      .sort();

    if (sorted.length > 0) {
      const daysSince = Math.floor(
        (Date.now() - new Date(sorted.at(-1)! + 'T12:00:00').getTime()) / 86400000,
      );
      if (daysSince >= 2) return 'traurig';
    }
  }

  return 'cool';
}
