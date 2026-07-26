import type { ParsedLecture } from './lecture-file.schema';

/**
 * The pure diffing core of the deploy-time import (`npm run content:import`, ROADMAP §I2):
 * current DB state + parsed files → an action plan. Pure so the version-bump semantics are unit-
 * testable without a database; the script executes the plan transactionally.
 *
 * Invariants encoded here:
 * - At most one non-superseded row per slug (the caller queries exactly those); its version is the
 *   highest ever created, so `version + 1` can never collide with a superseded row.
 * - Old rows are NEVER mutated or deleted — a content change creates a new row and supersedes the
 *   old one; a removed file retires the lecture (superseded), never deletes it. Pinned assignments
 *   keep playing either way.
 * - `status`/`sourcePath` changes without a content change update in place (no spurious version).
 */

export interface CurrentLectureRow {
  id: string;
  slug: string;
  version: number;
  status: string; // 'draft' | 'published'
  contentHash: string | null;
  sourcePath: string | null;
}

export type ImportAction =
  | { kind: 'create'; lecture: ParsedLecture; version: 1 }
  | { kind: 'bump'; lecture: ParsedLecture; version: number; supersedeId: string }
  | { kind: 'update-meta'; lecture: ParsedLecture; id: string; status?: string; sourcePath?: string }
  | { kind: 'noop'; slug: string }
  | { kind: 'retire'; slug: string; id: string };

export function planImport(current: CurrentLectureRow[], files: ParsedLecture[]): ImportAction[] {
  const bySlug = new Map(current.map((row) => [row.slug, row]));
  const actions: ImportAction[] = [];
  const seen = new Set<string>();

  for (const lecture of files) {
    seen.add(lecture.slug);
    const cur = bySlug.get(lecture.slug);
    if (!cur) {
      actions.push({ kind: 'create', lecture, version: 1 });
      continue;
    }
    if (cur.contentHash === lecture.contentHash) {
      const status = cur.status !== lecture.status ? lecture.status : undefined;
      const sourcePath = cur.sourcePath !== lecture.sourcePath ? lecture.sourcePath : undefined;
      if (status !== undefined || sourcePath !== undefined) {
        actions.push({ kind: 'update-meta', lecture, id: cur.id, status, sourcePath });
      } else {
        actions.push({ kind: 'noop', slug: lecture.slug });
      }
      continue;
    }
    actions.push({ kind: 'bump', lecture, version: cur.version + 1, supersedeId: cur.id });
  }

  for (const row of current) {
    if (!seen.has(row.slug)) actions.push({ kind: 'retire', slug: row.slug, id: row.id });
  }

  return actions;
}
