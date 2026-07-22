import type { ItemBankModel } from '../../generated/prisma/models';

/** Default number of items per bank session. */
export const DEFAULT_SESSION_SIZE = 8;
/** How many already-mastered items to mix in for confidence when there is weak/due work to drill. */
export const MIN_CONFIDENCE_ITEMS = 2;
/** A skill is "weak" below this first-pass correct rate over the recent window. */
export const WEAK_CORRECT_RATE = 0.7;
/** …or when the student is consistently slow on it (mean answer time over this many ms). */
export const SLOW_MS = 15_000;

/** One recent attempt, reduced to what weak-skill detection needs. */
export interface AttemptSignal {
  skillTags: string[];
  isCorrect: boolean;
  timeMs: number;
}

/**
 * Skills the student is struggling with, derived from recent attempts (SPEC §8A step 1): low correct
 * rate or slow responses. Pure and deterministic.
 */
export function weakSkills(attempts: readonly AttemptSignal[]): Set<string> {
  const agg = new Map<string, { n: number; correct: number; time: number }>();
  for (const a of attempts) {
    for (const tag of a.skillTags) {
      const cur = agg.get(tag) ?? { n: 0, correct: 0, time: 0 };
      cur.n += 1;
      if (a.isCorrect) cur.correct += 1;
      cur.time += a.timeMs;
      agg.set(tag, cur);
    }
  }
  const weak = new Set<string>();
  for (const [tag, s] of agg) {
    if (s.correct / s.n < WEAK_CORRECT_RATE || s.time / s.n > SLOW_MS) weak.add(tag);
  }
  return weak;
}

/**
 * Deterministic bank selection (SPEC §8A steps 3–4): prioritise items whose skill_tags hit the
 * weak/due set, reserve a couple of mastered items for confidence, then present easy→hard. No LLM,
 * no randomness — ties break on difficulty then id so the same inputs always yield the same session.
 */
export function selectBankItems(
  items: readonly ItemBankModel[],
  prioritySkills: ReadonlySet<string>,
  size: number = DEFAULT_SESSION_SIZE,
): ItemBankModel[] {
  const score = (it: ItemBankModel): number => it.skillTags.filter((t) => prioritySkills.has(t)).length;
  const ranked = [...items].sort(
    (a, b) => score(b) - score(a) || a.difficulty - b.difficulty || cmpId(a.id, b.id),
  );
  const priority = ranked.filter((it) => score(it) > 0);
  const mastered = ranked.filter((it) => score(it) === 0);

  const take = Math.min(size, items.length);
  const confidenceSlots =
    priority.length > 0 ? Math.min(MIN_CONFIDENCE_ITEMS, mastered.length, Math.max(0, take - 1)) : 0;

  const chosen = new Set<ItemBankModel>();
  for (const it of priority) {
    if (chosen.size >= take - confidenceSlots) break;
    chosen.add(it);
  }
  for (const it of mastered) {
    if (chosen.size >= take) break;
    chosen.add(it);
  }
  for (const it of ranked) {
    if (chosen.size >= take) break;
    chosen.add(it); // top up if priority/mastered were too few to fill the session
  }

  return [...chosen].sort((a, b) => a.difficulty - b.difficulty || cmpId(a.id, b.id));
}

function cmpId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
