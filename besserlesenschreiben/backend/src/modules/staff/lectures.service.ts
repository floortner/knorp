import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../common/exceptions/api-exception';
import { toExercise } from '../sessions/exercise.mapper';
import { servableExerciseWhere } from '../../contract/exercise';
import type { Prisma } from '../../generated/prisma/client';
import { sessionRollup } from './student-activity.service';

const MAX_LIMIT = 50;

type LectureRow = Prisma.LectureGetPayload<{
  select: {
    id: true;
    slug: true;
    version: true;
    title: true;
    intro: true;
    itemIds: true;
    skillTags: true;
    status: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

const LECTURE_SELECT = {
  id: true,
  slug: true,
  version: true,
  title: true,
  intro: true,
  itemIds: true,
  skillTags: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Content-library lectures + assignments (ROADMAP §H1/§I3) — the teaching console's read + assign
 * model, for ALL trainers (known-trainer model). Lectures are authored as markdown in content/ and
 * imported versioned by the deploy (§I2); the wire never sees 'superseded' rows. Assignments pin the
 * exact lecture-version row via the lecture_id FK — a linguist's edit never changes what an assigned
 * student sees. Assignment counts and tables span ALL versions of a slug, so a version bump never
 * resets the trainer's history.
 */
@Injectable()
export class LecturesService {
  private readonly logger = new Logger('LecturesService');

  constructor(private readonly prisma: PrismaService) {}

  /** Cursor-paged lecture list (current versions only), newest first, with per-status assignment counts. */
  async list(limit: number, cursor?: string) {
    const take = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const where = { status: { not: 'superseded' } } as const;
    const [rows, total] = await Promise.all([
      this.prisma.lecture.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: LECTURE_SELECT,
      }),
      this.prisma.lecture.count({ where }),
    ]);
    const page = rows.slice(0, take);

    const counts = await this.assignmentCountsFor(page);
    return {
      items: page.map((l) => this.toListItem(l, counts.get(this.slugKey(l)))),
      nextCursor: rows.length > take ? page[page.length - 1].id : null,
      total,
    };
  }

  async detail(lectureId: string) {
    const lecture = await this.byId(lectureId);
    // servable filter: old pinned versions may reference retired types — preview what can be played.
    const rows = await this.prisma.itemBank.findMany({
      where: { id: { in: lecture.itemIds }, ...servableExerciseWhere },
    });
    const byId = new Map(rows.map((i) => [i.id, i]));
    const counts = await this.assignmentCountsFor([lecture]);
    return {
      ...this.toListItem(lecture, counts.get(this.slugKey(lecture))),
      intro: lecture.intro,
      items: lecture.itemIds.flatMap((id) => (byId.has(id) ? [toExercise(byId.get(id)!)] : [])),
    };
  }

  /**
   * Assign to N students, idempotently. Cross-version dedupe: a profile with an UNCOMPLETED
   * assignment on any version of the same slug is skipped (they already have this lecture waiting);
   * a completed older-version assignment does not block — assigning the updated material again is a
   * deliberate act.
   */
  async assign(trainerId: string, lectureId: string, profileIds: string[]) {
    const lecture = await this.byId(lectureId);
    if (lecture.status !== 'published') {
      throw new ApiException(409, 'LECTURE_NOT_PUBLISHED', 'Nur veröffentlichte Lektionen können zugewiesen werden.');
    }
    const known = await this.prisma.profile.findMany({ where: { id: { in: profileIds } }, select: { id: true } });
    if (known.length !== new Set(profileIds).size) {
      throw new ApiException(404, 'NOT_FOUND', 'Profil nicht gefunden.');
    }

    const open = await this.prisma.assignment.findMany({
      where: {
        profileId: { in: profileIds },
        completedAt: null,
        lecture: this.sameLectureWhere(lecture),
      },
      select: { profileId: true },
    });
    const blocked = new Set(open.map((a) => a.profileId));
    const eligible = profileIds.filter((id) => !blocked.has(id));

    const result = await this.prisma.assignment.createMany({
      data: eligible.map((profileId) => ({ lectureId, profileId, assignedBy: trainerId })),
      skipDuplicates: true, // (lectureId, profileId) unique — same-version re-assign is a counted no-op
    });
    this.logger.log(
      { event: 'lecture.assigned', lectureId, assigned: result.count, skipped: profileIds.length - result.count },
      'lecture assigned',
    );
    return { assigned: result.count, skipped: profileIds.length - result.count };
  }

  /**
   * Per-student assignment status + outcome rollup across ALL versions of the lecture's slug
   * (feeds §H3.4's abandoned/never-started view; a version bump keeps the history visible).
   */
  async assignments(lectureId: string) {
    const lecture = await this.byId(lectureId);
    const rows = await this.prisma.assignment.findMany({
      where: { lecture: this.sameLectureWhere(lecture) },
      orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }],
      include: {
        profile: { select: { name: true } },
        session: { select: { id: true, source: true, itemIds: true, createdAt: true, completedAt: true } },
      },
    });
    const sessionIds = rows.flatMap((r) => (r.session ? [r.session.id] : []));
    const attempts = await this.prisma.attempt.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { sessionId: true, itemId: true, isCorrect: true, timeMs: true },
    });
    const bySession = new Map<string, typeof attempts>();
    for (const a of attempts) {
      const list = bySession.get(a.sessionId) ?? [];
      list.push(a);
      bySession.set(a.sessionId, list);
    }

    return {
      items: rows.map((r) => {
        const rollup = r.session ? sessionRollup(r.session, bySession.get(r.session.id) ?? []) : null;
        return {
          assignmentId: r.id,
          profileId: r.profileId,
          name: r.profile.name,
          status: r.completedAt ? ('completed' as const) : r.sessionId ? ('started' as const) : ('open' as const),
          assignedAt: r.assignedAt.toISOString(),
          sessionId: r.sessionId,
          completedAt: r.completedAt ? r.completedAt.toISOString() : null,
          correctPct: rollup?.correctPct ?? null,
          itemsAnswered: rollup?.itemsAnswered ?? 0,
          itemsTotal: rollup?.itemsTotal ?? 0,
          activeMs: rollup?.activeMs ?? 0,
        };
      }),
    };
  }

  /**
   * All assignments for ONE student, newest-first — the learner detail's "Zuweisungen" section. This
   * is the only surface where an OPEN (never-started) assignment is visible on the student's page;
   * the session timeline can only show played ones. Keyed by lecture (title + pinned version).
   */
  async studentAssignments(profileId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id: profileId }, select: { id: true } });
    if (!profile) throw new ApiException(404, 'NOT_FOUND', 'Profil nicht gefunden.');
    const rows = await this.prisma.assignment.findMany({
      where: { profileId },
      orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }],
      include: {
        lecture: { select: { id: true, title: true, version: true } },
        session: { select: { id: true, source: true, itemIds: true, createdAt: true, completedAt: true } },
      },
    });
    const attempts = await this.prisma.attempt.findMany({
      where: { sessionId: { in: rows.flatMap((r) => (r.session ? [r.session.id] : [])) } },
      select: { sessionId: true, itemId: true, isCorrect: true, timeMs: true },
    });
    const bySession = new Map<string, typeof attempts>();
    for (const a of attempts) {
      const list = bySession.get(a.sessionId) ?? [];
      list.push(a);
      bySession.set(a.sessionId, list);
    }

    return {
      items: rows.map((r) => {
        const rollup = r.session ? sessionRollup(r.session, bySession.get(r.session.id) ?? []) : null;
        return {
          assignmentId: r.id,
          lectureId: r.lecture.id,
          title: r.lecture.title,
          version: r.lecture.version,
          status: r.completedAt ? ('completed' as const) : r.sessionId ? ('started' as const) : ('open' as const),
          assignedAt: r.assignedAt.toISOString(),
          sessionId: r.sessionId,
          completedAt: r.completedAt ? r.completedAt.toISOString() : null,
          correctPct: rollup?.correctPct ?? null,
        };
      }),
    };
  }

  /** Withdraw an uncompleted assignment (trainer mistake-recovery); completed ones are immutable. */
  async withdraw(lectureId: string, assignmentId: string): Promise<{ ok: true }> {
    const lecture = await this.byId(lectureId);
    const assignment = await this.prisma.assignment.findFirst({
      where: { id: assignmentId, lecture: this.sameLectureWhere(lecture) },
    });
    if (!assignment) throw new ApiException(404, 'NOT_FOUND', 'Zuweisung nicht gefunden.');
    if (assignment.completedAt) {
      throw new ApiException(409, 'ALREADY_COMPLETED', 'Erledigte Zuweisungen können nicht zurückgezogen werden.');
    }
    await this.prisma.assignment.delete({ where: { id: assignmentId } });
    this.logger.log({ event: 'assignment.withdrawn', lectureId, assignmentId }, 'assignment withdrawn');
    return { ok: true };
  }

  /** Current (non-superseded) lecture by id — superseded versions are reachable only via their slug's successor. */
  private async byId(lectureId: string) {
    const lecture = await this.prisma.lecture.findUnique({ where: { id: lectureId }, select: LECTURE_SELECT });
    if (!lecture || lecture.status === 'superseded') {
      throw new ApiException(404, 'NOT_FOUND', 'Lektion nicht gefunden.');
    }
    return lecture;
  }

  /** All versions of the same lecture: by slug for content rows, by id for legacy (slug-null) rows. */
  private sameLectureWhere(lecture: LectureRow): Prisma.LectureWhereInput {
    return lecture.slug !== null ? { slug: lecture.slug } : { id: lecture.id };
  }

  private slugKey(l: LectureRow): string {
    return l.slug ?? l.id;
  }

  /** Assignment counts per slug (all versions), keyed like slugKey(). */
  private async assignmentCountsFor(lectures: LectureRow[]) {
    const slugs = [...new Set(lectures.flatMap((l) => (l.slug !== null ? [l.slug] : [])))];
    const legacyIds = lectures.filter((l) => l.slug === null).map((l) => l.id);
    const rows = await this.prisma.assignment.findMany({
      where: {
        OR: [
          ...(slugs.length > 0 ? [{ lecture: { slug: { in: slugs } } }] : []),
          ...(legacyIds.length > 0 ? [{ lectureId: { in: legacyIds } }] : []),
        ],
      },
      select: { lectureId: true, sessionId: true, completedAt: true, lecture: { select: { slug: true } } },
    });
    const counts = new Map<string, { open: number; started: number; completed: number }>();
    for (const a of rows) {
      const key = a.lecture.slug ?? a.lectureId;
      const c = counts.get(key) ?? { open: 0, started: 0, completed: 0 };
      if (a.completedAt) c.completed += 1;
      else if (a.sessionId) c.started += 1;
      else c.open += 1;
      counts.set(key, c);
    }
    return counts;
  }

  private toListItem(l: LectureRow, counts?: { open: number; started: number; completed: number }) {
    return {
      lectureId: l.id,
      slug: l.slug ?? l.id, // legacy rows have no slug; their id is the stable stand-in
      version: l.version,
      title: l.title,
      status: z.enum(['draft', 'published']).parse(l.status),
      skillTags: l.skillTags,
      itemCount: l.itemIds.length,
      assignmentCounts: counts ?? { open: 0, started: 0, completed: 0 },
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    };
  }
}
