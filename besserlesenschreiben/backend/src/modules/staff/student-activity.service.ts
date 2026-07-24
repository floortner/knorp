import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../common/exceptions/api-exception';
import { daysAgo } from '../../common/dates';
import { skillBreakdown } from '../progress/progress.stats';

const MAX_LIMIT = 50;
const SKILL_WINDOW_DAYS = 30; // same rollup window as StaffProgressService
const DIRECTORY_SKILLS = 3; // weakest-first teaser on the list row; the detail carries the full list

/** The session fields the rollup needs (keeps the pure helpers testable without Prisma types). */
interface SessionRow {
  id: string;
  source: string;
  itemIds: string[];
  createdAt: Date;
  completedAt: Date | null;
}

interface AttemptRollupRow {
  sessionId: string;
  itemId: string | null;
  isCorrect: boolean;
  timeMs: number;
}

/**
 * Summarise one session from its attempt rows (§H3.1). Homework sessions are terminal by design —
 * created already-decided with `itemIds: []` and no `completedAt` (review.service) — so they are
 * never "abandoned" and their itemsAnswered is the attempt-row count (their attempts carry no itemId).
 */
export function sessionRollup(session: SessionRow, attempts: readonly AttemptRollupRow[]) {
  const isHomework = session.source === 'homework';
  const answeredItems = new Set(attempts.map((a) => a.itemId).filter((id): id is string => id != null));
  const correct = attempts.filter((a) => a.isCorrect).length;
  return {
    sessionId: session.id,
    source: session.source,
    startedAt: session.createdAt.toISOString(),
    completedAt: session.completedAt ? session.completedAt.toISOString() : null,
    abandoned: session.completedAt === null && !isHomework,
    itemsTotal: session.itemIds.length,
    itemsAnswered: isHomework ? attempts.length : answeredItems.size,
    attemptCount: attempts.length,
    correctPct: attempts.length === 0 ? null : Math.round((correct / attempts.length) * 100),
    activeMs: attempts.reduce((sum, a) => sum + a.timeMs, 0),
  };
}

/**
 * The trainer's per-student activity read model (ROADMAP §H3.1) — a read-only view over the existing
 * session/attempt telemetry, no new tables. ALL trainers (known-trainer model, §H1.3): students are
 * listed by real name; parent email/chat/billing never appear here. Staff aren't account-scoped, so
 * profiles are looked up directly (missing → 404), like StaffProgressService.
 */
@Injectable()
export class StudentActivityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The learner directory: every profile with identity + a light activity teaser. Cursor-paged,
   * name-ordered. Aggregates are page-scoped (grouped over just the page's profile ids) — O(page),
   * not O(students); revisit the 30d attempt fetch first if profiles ever grow past a few hundred.
   */
  async directory(limit: number, cursor?: string) {
    const take = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const now = new Date();
    const [rows, total] = await Promise.all([
      this.prisma.profile.findMany({
        orderBy: [{ name: 'asc' }, { id: 'asc' }], // secondary id key → stable cursor paging on name ties
        take: take + 1, // one extra to know if there's a next page
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, name: true, unlockedUnit: true, streakDays: true, lastActive: true },
      }),
      this.prisma.profile.count(),
    ]);
    const page = rows.slice(0, take);
    const ids = page.map((p) => p.id);

    const [done7d, done30d, attemptTotals, windowAttempts, dueRows] = await Promise.all([
      this.prisma.session.groupBy({
        by: ['profileId'],
        where: { profileId: { in: ids }, completedAt: { gte: daysAgo(now, 7) } },
        _count: true,
      }),
      this.prisma.session.groupBy({
        by: ['profileId'],
        where: { profileId: { in: ids }, completedAt: { gte: daysAgo(now, 30) } },
        _count: true,
      }),
      this.prisma.attempt.groupBy({ by: ['profileId'], where: { profileId: { in: ids } }, _count: true }),
      this.prisma.attempt.findMany({
        where: { profileId: { in: ids }, createdAt: { gte: daysAgo(now, SKILL_WINDOW_DAYS) } },
        select: { profileId: true, skillTags: true, isCorrect: true, createdAt: true },
      }),
      this.prisma.reviewState.findMany({
        where: { profileId: { in: ids }, due: { lte: now } },
        select: { profileId: true, skillTag: true },
      }),
    ]);

    const countBy = (grouped: { profileId: string; _count: number }[]) =>
      new Map(grouped.map((g) => [g.profileId, g._count]));
    const sessions7d = countBy(done7d);
    const sessions30d = countBy(done30d);
    const totalAttempts = countBy(attemptTotals);
    const attemptsByProfile = new Map<string, typeof windowAttempts>();
    for (const a of windowAttempts) {
      const list = attemptsByProfile.get(a.profileId) ?? [];
      list.push(a);
      attemptsByProfile.set(a.profileId, list);
    }
    const dueByProfile = new Map<string, Set<string>>();
    for (const r of dueRows) {
      const set = dueByProfile.get(r.profileId) ?? new Set<string>();
      set.add(r.skillTag);
      dueByProfile.set(r.profileId, set);
    }

    const items = page.map((p) => ({
      profileId: p.id,
      name: p.name,
      unit: p.unlockedUnit,
      streakDays: p.streakDays,
      lastActive: p.lastActive ? p.lastActive.toISOString() : null,
      sessions7d: sessions7d.get(p.id) ?? 0,
      sessions30d: sessions30d.get(p.id) ?? 0,
      totalAttempts: totalAttempts.get(p.id) ?? 0,
      weakestSkills: skillBreakdown(attemptsByProfile.get(p.id) ?? [], dueByProfile.get(p.id) ?? new Set(), now)
        .slice(0, DIRECTORY_SKILLS)
        .map((s) => ({ skill: s.skill, attempts: s.attempts, correctPct: s.correctPct, due: s.due })),
    }));

    const nextCursor = rows.length > take ? page[page.length - 1].id : null;
    return { items, nextCursor, total };
  }

  /** Session history for one student, newest-first; optional source filter. Cursor-paged. */
  async sessions(profileId: string, opts: { limit: number; cursor?: string; source?: string }) {
    await this.assertProfile(profileId);
    const take = Math.min(Math.max(opts.limit, 1), MAX_LIMIT);
    const where = { profileId, ...(opts.source ? { source: opts.source } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.session.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
        ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
        select: { id: true, source: true, itemIds: true, createdAt: true, completedAt: true },
      }),
      this.prisma.session.count({ where }),
    ]);
    const page = rows.slice(0, take);

    const attempts = await this.prisma.attempt.findMany({
      where: { sessionId: { in: page.map((s) => s.id) } },
      select: { sessionId: true, itemId: true, isCorrect: true, timeMs: true },
    });
    const bySession = new Map<string, typeof attempts>();
    for (const a of attempts) {
      const list = bySession.get(a.sessionId) ?? [];
      list.push(a);
      bySession.set(a.sessionId, list);
    }

    return {
      items: page.map((s) => sessionRollup(s, bySession.get(s.id) ?? [])),
      nextCursor: rows.length > take ? page[page.length - 1].id : null,
      total,
    };
  }

  /** Question-by-question drill-down: the session summary + student name + attempts in answer order. */
  async sessionDetail(profileId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      // Join the profile name so the drill-down screen needs no separate progress rollup for its header.
      select: {
        id: true,
        profileId: true,
        source: true,
        itemIds: true,
        createdAt: true,
        completedAt: true,
        profile: { select: { name: true } },
      },
    });
    // A mismatched profileId in the path is a 404, not a hint that the session exists elsewhere.
    if (!session || session.profileId !== profileId) {
      throw new ApiException(404, 'NOT_FOUND', 'Sitzung nicht gefunden.');
    }
    const attempts = await this.prisma.attempt.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], // answer order; id breaks same-ms ties
    });
    return {
      ...sessionRollup(session, attempts),
      name: session.profile.name,
      attempts: attempts.map((a) => ({
        attemptId: a.id,
        itemId: a.itemId,
        exerciseType: a.exerciseType,
        prompt: a.prompt,
        expected: a.expected,
        given: a.given,
        isCorrect: a.isCorrect,
        timeMs: a.timeMs,
        attemptNo: a.attemptNo,
        skillTags: a.skillTags,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  private async assertProfile(profileId: string): Promise<void> {
    const profile = await this.prisma.profile.findUnique({ where: { id: profileId }, select: { id: true } });
    if (!profile) throw new ApiException(404, 'NOT_FOUND', 'Profil nicht gefunden.');
  }
}
