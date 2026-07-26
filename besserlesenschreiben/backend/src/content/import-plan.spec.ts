import { describe, it, expect } from 'vitest';
import { planImport, type CurrentLectureRow } from './import-plan';
import { parseLectureFile } from './parser';
import type { ParsedLecture } from './lecture-file.schema';

/**
 * The version-bump semantics of the deploy-time import (§I2), tested pure: DB state + files → plan.
 * The execution side (item upsert by content-addressed seed_key, transactions) is exercised by the
 * manual verification flow and the e2e suite against a real DB.
 */

function lecture(slug: string, overrides: { intro?: string; status?: string } = {}): ParsedLecture {
  const raw = `---
title: "Lektion ${slug}"
intro: "${overrides.intro ?? 'Der Merksatz.'}"
${overrides.status ? `status: ${overrides.status}` : ''}
exercises:
  - id: aufgabe-1
    type: placeholder
    prompt: "Frage?"
    options: ["eins", "zwei"]
    answer: "eins"
    praise: "Toll!"
    skills: [placeholder]
---
`;
  const result = parseLectureFile(`content/lectures/${slug}.md`, raw);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.lecture;
}

function row(l: ParsedLecture, overrides: Partial<CurrentLectureRow> = {}): CurrentLectureRow {
  return {
    id: `id-${l.slug}-v${overrides.version ?? 1}`,
    slug: l.slug,
    version: 1,
    status: l.status,
    contentHash: l.contentHash,
    sourcePath: l.sourcePath,
    ...overrides,
  };
}

describe('planImport', () => {
  it('new slug → create v1', () => {
    const file = lecture('neu');
    expect(planImport([], [file])).toEqual([{ kind: 'create', lecture: file, version: 1 }]);
  });

  it('unchanged content → noop (idempotent re-import)', () => {
    const file = lecture('gleich');
    expect(planImport([row(file)], [file])).toEqual([{ kind: 'noop', slug: 'gleich' }]);
  });

  it('changed content → bump to version+1, superseding the current row', () => {
    const v1 = lecture('geaendert');
    const v2 = lecture('geaendert', { intro: 'Neuer Merksatz.' });
    expect(planImport([row(v1, { version: 3, id: 'id-v3' })], [v2])).toEqual([
      { kind: 'bump', lecture: v2, version: 4, supersedeId: 'id-v3' },
    ]);
  });

  it('status-only change (draft → published) → in-place meta update, NO version bump', () => {
    const draft = lecture('freigabe', { status: 'draft' });
    const published = lecture('freigabe');
    expect(draft.contentHash).toBe(published.contentHash); // status is excluded from the hash
    expect(planImport([row(draft)], [published])).toEqual([
      { kind: 'update-meta', lecture: published, id: row(draft).id, status: 'published', sourcePath: undefined },
    ]);
  });

  it('file removed → retire, never delete', () => {
    const gone = lecture('entfernt');
    expect(planImport([row(gone)], [])).toEqual([{ kind: 'retire', slug: 'entfernt', id: row(gone).id }]);
  });

  it('reverting to earlier content still bumps forward (no version reuse)', () => {
    const v1 = lecture('zurueck');
    const v2 = lecture('zurueck', { intro: 'Zwischenstand.' });
    // The file was reverted to v1's content while the DB is on v2 → forward bump to v3.
    expect(planImport([row(v2, { version: 2, id: 'id-v2' })], [v1])).toEqual([
      { kind: 'bump', lecture: v1, version: 3, supersedeId: 'id-v2' },
    ]);
  });

  it('handles a mixed plan across many files in one pass', () => {
    const stays = lecture('bleibt');
    const changes = lecture('wandelt');
    const changed = lecture('wandelt', { intro: 'Anders.' });
    const fresh = lecture('frisch');
    const gone = lecture('weg');
    const plan = planImport([row(stays), row(changes), row(gone)], [stays, changed, fresh]);
    expect(plan.map((a) => a.kind).sort()).toEqual(['bump', 'create', 'noop', 'retire']);
  });
});
