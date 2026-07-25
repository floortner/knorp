import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../common/exceptions/api-exception';
import { solvableExerciseSchema } from '../../contract/exercise';
import { toExercise } from '../sessions/exercise.mapper';
import type { Prisma } from '../../generated/prisma/client';
import { sessionRollup } from './student-activity.service';
import type { LectureUpsertInput } from './staff.dto';

const MAX_LIMIT = 50;
// Staff-authored items live at the same out-of-catalogue unit as LLM items; the bank-session pool
// filters generatedBy:'llm' explicitly, so these never leak into bank rotation.
const STAFF_ITEM_UNIT = 0;

type LectureRow = Prisma.LectureGetPayload<{ include: { author: { select: { name: true } } } }>;

/**
 * Staff-authored lectures + assignments (ROADMAP §H1) — the teaching console's write model, for ALL
 * trainers (known-trainer model). A lecture's exercises are gated through `solvableExerciseSchema` on
 * every save, so a student can never receive an unanswerable item regardless of author (§H invariant).
 * Drafts are editable; published lectures are immutable (unpublish only while unassigned).
 */
@Injectable()
export class LecturesService {
  private readonly logger = new Logger('LecturesService');

  constructor(private readonly prisma: PrismaService) {}

  /** Compose the full wire exercise from an authoring input and gate it through the solvability schema. */
  private validateItems(items: LectureUpsertInput['items']) {
    for (const [i, item] of items.entries()) {
      const candidate = { ...item, id: 'authoring', audioUrl: null };
      const parsed = solvableExerciseSchema.safeParse(candidate);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        throw new ApiException(422, 'UNSOLVABLE_ITEM', 'Aufgabe ist nicht eindeutig lösbar.', [
          { field: `items.${i}.${first.path.join('.')}`, issue: first.message },
        ]);
      }
    }
  }

  /** Cursor-paged lecture list, newest first, with per-status assignment counts. */
  async list(limit: number, cursor?: string) {
    const take = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const [rows, total] = await Promise.all([
      this.prisma.lecture.findMany({
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { author: { select: { name: true } } },
      }),
      this.prisma.lecture.count(),
    ]);
    const page = rows.slice(0, take);

    const assignments = await this.prisma.assignment.findMany({
      where: { lectureId: { in: page.map((l) => l.id) } },
      select: { lectureId: true, sessionId: true, completedAt: true },
    });
    const counts = new Map<string, { open: number; started: number; completed: number }>();
    for (const a of assignments) {
      const c = counts.get(a.lectureId) ?? { open: 0, started: 0, completed: 0 };
      if (a.completedAt) c.completed += 1;
      else if (a.sessionId) c.started += 1;
      else c.open += 1;
      counts.set(a.lectureId, c);
    }

    return {
      items: page.map((l) => this.toListItem(l, counts.get(l.id))),
      nextCursor: rows.length > take ? page[page.length - 1].id : null,
      total,
    };
  }

  async create(trainerId: string, dto: LectureUpsertInput) {
    this.validateItems(dto.items);
    const lecture = await this.prisma.$transaction(async (tx) => {
      const itemIds: string[] = [];
      for (const item of dto.items) {
        itemIds.push((await this.createItemRow(tx, item)).id);
      }
      return tx.lecture.create({
        data: {
          createdBy: trainerId,
          title: dto.title,
          intro: dto.intro,
          itemIds,
          skillTags: [...new Set(dto.items.flatMap((i) => i.skillTags))],
        },
        include: { author: { select: { name: true } } },
      });
    });
    this.logger.log({ event: 'lecture.created', lectureId: lecture.id, items: dto.items.length }, 'lecture created');
    return this.detail(lecture.id);
  }

  /** Draft-only edit: item rows are deleted and recreated (drafts have no attempts, so this is safe). */
  async update(lectureId: string, dto: LectureUpsertInput) {
    const existing = await this.byId(lectureId);
    if (existing.status !== 'draft') {
      throw new ApiException(409, 'LECTURE_PUBLISHED', 'Veröffentlichte Lektionen können nicht bearbeitet werden.');
    }
    this.validateItems(dto.items);
    await this.prisma.$transaction(async (tx) => {
      await tx.itemBank.deleteMany({ where: { id: { in: existing.itemIds } } });
      const itemIds: string[] = [];
      for (const item of dto.items) {
        itemIds.push((await this.createItemRow(tx, item)).id);
      }
      await tx.lecture.update({
        where: { id: lectureId },
        data: {
          title: dto.title,
          intro: dto.intro,
          itemIds,
          skillTags: [...new Set(dto.items.flatMap((i) => i.skillTags))],
        },
      });
    });
    return this.detail(lectureId);
  }

  async detail(lectureId: string) {
    const lecture = await this.byId(lectureId);
    const rows = await this.prisma.itemBank.findMany({ where: { id: { in: lecture.itemIds } } });
    const byId = new Map(rows.map((i) => [i.id, i]));
    const counts = await this.assignmentCounts(lectureId);
    return {
      ...this.toListItem(lecture, counts),
      intro: lecture.intro,
      items: lecture.itemIds.flatMap((id) => (byId.has(id) ? [toExercise(byId.get(id)!)] : [])),
    };
  }

  async publish(lectureId: string) {
    const lecture = await this.byId(lectureId);
    if (lecture.status !== 'published') {
      await this.prisma.lecture.update({ where: { id: lectureId }, data: { status: 'published' } });
      this.logger.log({ event: 'lecture.published', lectureId }, 'lecture published');
    }
    return this.detail(lectureId);
  }

  /** Back to draft — only while nothing is assigned (assigned lectures must stay stable). */
  async unpublish(lectureId: string) {
    await this.byId(lectureId);
    const assigned = await this.prisma.assignment.count({ where: { lectureId } });
    if (assigned > 0) {
      throw new ApiException(409, 'LECTURE_ASSIGNED', 'Zugewiesene Lektionen können nicht zurückgezogen werden.');
    }
    await this.prisma.lecture.update({ where: { id: lectureId }, data: { status: 'draft' } });
    return this.detail(lectureId);
  }

  /** Draft-only delete; removes the lecture's item rows too. */
  async remove(lectureId: string): Promise<{ ok: true }> {
    const lecture = await this.byId(lectureId);
    if (lecture.status !== 'draft') {
      throw new ApiException(409, 'LECTURE_PUBLISHED', 'Nur Entwürfe können gelöscht werden.');
    }
    await this.prisma.$transaction([
      this.prisma.itemBank.deleteMany({ where: { id: { in: lecture.itemIds } } }),
      this.prisma.lecture.delete({ where: { id: lectureId } }),
    ]);
    this.logger.log({ event: 'lecture.deleted', lectureId }, 'draft lecture deleted');
    return { ok: true };
  }

  /** Assign to N students, idempotently: already-assigned profiles are skipped and counted. */
  async assign(trainerId: string, lectureId: string, profileIds: string[]) {
    const lecture = await this.byId(lectureId);
    if (lecture.status !== 'published') {
      throw new ApiException(409, 'LECTURE_NOT_PUBLISHED', 'Nur veröffentlichte Lektionen können zugewiesen werden.');
    }
    const known = await this.prisma.profile.findMany({ where: { id: { in: profileIds } }, select: { id: true } });
    if (known.length !== new Set(profileIds).size) {
      throw new ApiException(404, 'NOT_FOUND', 'Profil nicht gefunden.');
    }
    const result = await this.prisma.assignment.createMany({
      data: profileIds.map((profileId) => ({ lectureId, profileId, assignedBy: trainerId })),
      skipDuplicates: true, // (lectureId, profileId) unique — re-assign is a counted no-op
    });
    this.logger.log(
      { event: 'lecture.assigned', lectureId, assigned: result.count, skipped: profileIds.length - result.count },
      'lecture assigned',
    );
    return { assigned: result.count, skipped: profileIds.length - result.count };
  }

  /** Per-student assignment status + outcome rollup (feeds §H3.4's abandoned/never-started view). */
  async assignments(lectureId: string) {
    await this.byId(lectureId);
    const rows = await this.prisma.assignment.findMany({
      where: { lectureId },
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

  /** Withdraw an uncompleted assignment (trainer mistake-recovery); completed ones are immutable. */
  async withdraw(lectureId: string, assignmentId: string): Promise<{ ok: true }> {
    const assignment = await this.prisma.assignment.findFirst({ where: { id: assignmentId, lectureId } });
    if (!assignment) throw new ApiException(404, 'NOT_FOUND', 'Zuweisung nicht gefunden.');
    if (assignment.completedAt) {
      throw new ApiException(409, 'ALREADY_COMPLETED', 'Erledigte Zuweisungen können nicht zurückgezogen werden.');
    }
    await this.prisma.assignment.delete({ where: { id: assignmentId } });
    this.logger.log({ event: 'assignment.withdrawn', lectureId, assignmentId }, 'assignment withdrawn');
    return { ok: true };
  }

  private async byId(lectureId: string) {
    const lecture = await this.prisma.lecture.findUnique({
      where: { id: lectureId },
      include: { author: { select: { name: true } } },
    });
    if (!lecture) throw new ApiException(404, 'NOT_FOUND', 'Lektion nicht gefunden.');
    return lecture;
  }

  private async assignmentCounts(lectureId: string) {
    const rows = await this.prisma.assignment.findMany({
      where: { lectureId },
      select: { sessionId: true, completedAt: true },
    });
    const counts = { open: 0, started: 0, completed: 0 };
    for (const a of rows) {
      if (a.completedAt) counts.completed += 1;
      else if (a.sessionId) counts.started += 1;
      else counts.open += 1;
    }
    return counts;
  }

  /** Persist one authored exercise exactly like the LLM path: payload minus backend-owned columns. */
  private createItemRow(tx: Prisma.TransactionClient, item: LectureUpsertInput['items'][number]) {
    const payload: Record<string, unknown> = { ...item };
    for (const k of ['id', 'type', 'audioUrl', 'syllableAudio', 'skillTags']) delete payload[k];
    return tx.itemBank.create({
      data: {
        unit: STAFF_ITEM_UNIT,
        exerciseType: item.type,
        payload: payload as Prisma.InputJsonValue,
        skillTags: item.skillTags,
        difficulty: 1,
        audioUrl: null,
        generatedBy: 'staff',
      },
    });
  }

  private toListItem(l: LectureRow, counts?: { open: number; started: number; completed: number }) {
    return {
      lectureId: l.id,
      title: l.title,
      status: z.enum(['draft', 'published']).parse(l.status),
      skillTags: l.skillTags,
      itemCount: l.itemIds.length,
      authorName: l.author.name,
      assignmentCounts: counts ?? { open: 0, started: 0, completed: 0 },
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    };
  }
}
