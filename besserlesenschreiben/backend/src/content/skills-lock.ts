/**
 * The skill-tag lock (`content/skills.lock.json`) — a committed, sorted copy of `SKILL_TAGS`.
 *
 * Skill tags are the durable spine of the telemetry: FSRS scheduling, the digest roll-up, and
 * LLM lecture targeting all key on them. A renamed or removed tag silently orphans every attempt
 * recorded under it. The lock makes any taxonomy change a *deliberate two-file diff*: CI stays red
 * until `contract/skills.ts` and the lock agree, so a rename can never slip through unreviewed.
 */

export interface SkillsLockDiff {
  /** In the taxonomy but not the lock — a new tag awaiting acknowledgement. */
  added: string[];
  /** In the lock but gone from the taxonomy — THE dangerous case (rename/removal). */
  removed: string[];
}

export function diffSkillsLock(lock: readonly string[], taxonomy: readonly string[]): SkillsLockDiff {
  const lockSet = new Set(lock);
  const taxonomySet = new Set(taxonomy);
  return {
    added: taxonomy.filter((t) => !lockSet.has(t)).sort(),
    removed: lock.filter((t) => !taxonomySet.has(t)).sort(),
  };
}

/** Canonical lock-file content: sorted, two-space indent, trailing newline. */
export function renderSkillsLock(taxonomy: readonly string[]): string {
  return JSON.stringify([...taxonomy].sort(), null, 2) + '\n';
}
