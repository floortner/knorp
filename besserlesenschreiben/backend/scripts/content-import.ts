/**
 * Import the lecture content library into the DB (ROADMAP §I2) — the deploy-time twin of
 * `content:validate`, run pre-traffic in deploy/release.sh right after the seed (and locally after
 * `migrate dev`). Idempotent: same files → all no-ops.
 *
 *   npm run content:import        (needs DATABASE_URL; CONTENT_DIR overrides the content directory)
 *
 * Semantics (planImport, src/content/import-plan.ts — pin-at-assign versioning):
 * - new slug → lecture v1; changed content → NEW lecture row (version+1), old row superseded
 * - exercises are content-addressed item_bank rows (seed_key content:{slug}.{exId}:{hash12}):
 *   unchanged → row reused, changed → new row; OLD ROWS ARE NEVER MUTATED OR DELETED, so attempts
 *   and pinned assignments always reference exactly what the student saw
 * - file removed → lecture retired (superseded), never deleted
 * - any invalid file → NOTHING is imported (a broken PR must never half-import)
 *
 * Logs identifiers + outcomes only (no content) per the logging rules.
 */
import 'dotenv/config';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client';
import { validateContent } from '../src/content/validate';
import { formatContentErrors } from '../src/content/report';
import { planImport, type CurrentLectureRow, type ImportAction } from '../src/content/import-plan';
import { contentSeedKey } from '../src/content/hash';
import type { ParsedLecture } from '../src/content/lecture-file.schema';

const contentDir = resolve(process.env.CONTENT_DIR ?? join(__dirname, '..', '..', '..', 'content'));
const CONTENT_ITEM_UNIT = 0; // out of the catalogue; bank rotation pools generatedBy:'llm' only

/** Upsert the lecture's item rows by content-addressed seed_key; returns ordered item ids. */
async function upsertItemRows(tx: Prisma.TransactionClient, lecture: ParsedLecture): Promise<string[]> {
  const itemIds: string[] = [];
  for (const ex of lecture.exercises) {
    const row = await tx.itemBank.upsert({
      where: { seedKey: contentSeedKey(lecture.slug, ex) },
      // Content-addressed: an existing key IS this exact content — nothing to update, ever.
      update: {},
      create: {
        seedKey: contentSeedKey(lecture.slug, ex),
        unit: CONTENT_ITEM_UNIT,
        exerciseType: ex.type,
        // Same payload shape as every other item source: the wire fields minus backend-owned columns.
        payload: { prompt: ex.prompt, options: ex.options, answer: ex.answer, praise: ex.praise },
        skillTags: ex.skills,
        difficulty: ex.difficulty,
        audioUrl: null,
        generatedBy: 'content',
      },
    });
    itemIds.push(row.id);
  }
  return itemIds;
}

async function execute(prisma: PrismaClient, action: ImportAction): Promise<string> {
  switch (action.kind) {
    case 'create':
    case 'bump': {
      const { lecture, version } = action;
      await prisma.$transaction(async (tx) => {
        const itemIds = await upsertItemRows(tx, lecture);
        await tx.lecture.create({
          data: {
            slug: lecture.slug,
            version,
            contentHash: lecture.contentHash,
            sourcePath: lecture.sourcePath,
            title: lecture.title,
            intro: lecture.intro,
            itemIds,
            skillTags: lecture.skillTags,
            status: lecture.status,
          },
        });
        if (action.kind === 'bump') {
          await tx.lecture.update({
            where: { id: action.supersedeId },
            data: { status: 'superseded', supersededAt: new Date() },
          });
        }
      });
      return `${action.kind === 'create' ? 'created' : 'bumped'} ${lecture.slug} v${version}`;
    }
    case 'update-meta': {
      // A published→draft flip un-publishes silently otherwise: the old portal blocked this
      // (409 LECTURE_ASSIGNED) while anyone was assigned. The file-driven pipeline can't reject a
      // deploy over an editorial choice, but it must not swallow it either — assigned students keep
      // playing (createAssigned doesn't gate on status), yet the lecture drops out of `assign`-
      // eligibility with no other signal. Loud log, same precedent as RETIRED below.
      let assignedWarning = '';
      if (action.status === 'draft') {
        const assignedCount = await prisma.assignment.count({ where: { lectureId: action.id } });
        if (assignedCount > 0) {
          assignedWarning = ` — WARNING: ${assignedCount} assignment(s) exist; new assignments are now blocked (409 LECTURE_NOT_PUBLISHED), already-assigned students keep playing`;
        }
      }
      await prisma.lecture.update({
        where: { id: action.id },
        data: {
          ...(action.status !== undefined ? { status: action.status } : {}),
          ...(action.sourcePath !== undefined ? { sourcePath: action.sourcePath } : {}),
        },
      });
      return `updated meta ${action.lecture.slug}${action.status ? ` (status → ${action.status})` : ''}${assignedWarning}`;
    }
    case 'retire': {
      await prisma.lecture.update({
        where: { id: action.id },
        data: { status: 'superseded', supersededAt: new Date() },
      });
      // Loud on purpose: a removed file should be a deliberate act, and open assignments keep playing.
      return `RETIRED ${action.slug} — file removed; pinned assignments keep serving`;
    }
    case 'noop':
      return `noop ${action.slug}`;
  }
}

async function main(): Promise<void> {
  if (!existsSync(contentDir)) {
    console.error(`Content-Verzeichnis nicht gefunden: ${contentDir}`);
    process.exit(1);
  }

  const { lectures, errors } = validateContent(contentDir);
  if (errors.length > 0) {
    for (const line of formatContentErrors(errors)) console.error(line);
    console.error('\nImport abgebrochen — es wurde nichts in die Datenbank geschrieben.');
    process.exit(1);
  }

  const adapter = new PrismaPg(process.env.DATABASE_URL as string);
  const prisma = new PrismaClient({ adapter });
  try {
    const rows = await prisma.lecture.findMany({
      where: { slug: { not: null }, status: { not: 'superseded' } },
      select: { id: true, slug: true, version: true, status: true, contentHash: true, sourcePath: true },
    });
    const current = rows as CurrentLectureRow[]; // slug is non-null by the where clause

    const actions = planImport(current, lectures);
    const counts = { created: 0, bumped: 0, 'update-meta': 0, noop: 0, retired: 0 };
    for (const action of actions) {
      const summary = await execute(prisma, action);
      if (action.kind === 'create') counts.created += 1;
      else if (action.kind === 'bump') counts.bumped += 1;
      else if (action.kind === 'update-meta') counts['update-meta'] += 1;
      else if (action.kind === 'retire') counts.retired += 1;
      else counts.noop += 1;
      if (action.kind !== 'noop') console.log(`[content-import] ${summary}`);
    }
    console.log(
      `[content-import] done: ${counts.created} created, ${counts.bumped} bumped, ${counts['update-meta']} meta-updated, ${counts.retired} retired, ${counts.noop} unchanged (${lectures.length} files)`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
