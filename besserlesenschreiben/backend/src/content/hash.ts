import { createHash } from 'node:crypto';

/**
 * Canonical content hashing for the lecture library. Hashes must be stable across key order and
 * incidental formatting so the deploy-time import can tell "same content" from "new version":
 * an unchanged exercise keeps its content-addressed `item_bank` row (seed_key
 * `content:{slug}.{exId}:{hash12}`); a changed one gets a new row and bumps the lecture version.
 */

/** Deterministic JSON: objects serialized with sorted keys, recursively. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * The content-addressed `item_bank.seed_key` for an imported exercise. Same content → same key →
 * the import's upsert reuses the existing row (stable itemIds across lecture versions); changed
 * content → new key → new row, while the old row keeps serving its pinned assignments forever.
 */
export function contentSeedKey(
  slug: string,
  ex: Parameters<typeof exerciseHash>[0] & { id: string },
): string {
  return `content:${slug}.${ex.id}:${exerciseHash(ex).slice(0, 12)}`;
}

/** Hash of one exercise's authored content. The `id` is identity, not content — excluded. */
export function exerciseHash(ex: {
  type: string;
  prompt: string;
  options: string[];
  answer: string;
  praise: string;
  skills: string[];
  difficulty: number;
}): string {
  const { type, prompt, options, answer, praise, skills, difficulty } = ex;
  return sha256Hex(stableStringify({ type, prompt, options, answer, praise, skills, difficulty }));
}

/**
 * Hash of the whole lecture's content: title + intro + the ordered [id, exerciseHash] pairs
 * (reordering IS a content change). `status` is deliberately excluded — draft→published must
 * not create a spurious version.
 */
export function lectureHash(lecture: {
  title: string;
  intro: string;
  exercises: { id: string; hash: string }[];
}): string {
  return sha256Hex(
    stableStringify({
      title: lecture.title,
      intro: lecture.intro,
      exercises: lecture.exercises.map((e) => [e.id, e.hash]),
    }),
  );
}
