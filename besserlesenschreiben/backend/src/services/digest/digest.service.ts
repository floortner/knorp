import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { assertProfileOwned } from '../../common/ownership';
import { daysAgo } from '../../common/dates';
import { StorageService } from '../storage/storage.service';
import { buildDigestData, renderDigest, type AssignedRow, type DueRow } from './digest.render';

const WINDOW_DAYS = 14;
const DUE_EXAMPLE_ITEMS = 3;
const MAX_ASSIGNED = 5; // most recent staff assignments surfaced to the LLM (§H3.3)

/**
 * Digest generation (SPEC §6/§8). Regenerates the compact `digest.md` from the attempt table on
 * demand (last ~14 days) + FSRS due skills, writes it through to per-user storage, and returns the
 * markdown. This is the LLM-facing view reused by chat and LLM-session generation.
 */
@Injectable()
export class DigestService {
  private readonly logger = new Logger('DigestService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async generate(accountId: string, profileId: string): Promise<{ markdown: string }> {
    const profile = await assertProfileOwned(this.prisma, accountId, profileId);
    const now = new Date();

    const attempts = await this.prisma.attempt.findMany({
      where: { profileId, createdAt: { gte: daysAgo(now, WINDOW_DAYS) } },
      select: { skillTags: true, isCorrect: true, timeMs: true, prompt: true, expected: true, given: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const dueStates = await this.prisma.reviewState.findMany({
      where: { profileId, due: { lte: now } },
      select: { skillTag: true },
      orderBy: { due: 'asc' },
    });
    const due: DueRow[] = await Promise.all(
      dueStates.map(async (s) => ({ skill: s.skillTag, examples: await this.examplesFor(s.skillTag) })),
    );
    const assigned = await this.assignedRows(profileId, now);

    const data = buildDigestData(
      {
        name: profile.name,
        buddy: profile.buddy,
        goalPerWeek: profile.goalPerWeek,
        soundOn: profile.soundOn,
        dyslexicFont: profile.dyslexicFont,
        fontScale: Number(profile.fontScale),
      },
      attempts,
      due,
      assigned,
      now,
      WINDOW_DAYS,
    );

    const markdown = renderDigest(data);
    // Best-effort cache: the digest is fully regenerable from the DB, so a storage hiccup must not
    // fail the request. Storage itself now throws on failure (no silent no-op); we absorb it here.
    try {
      await this.storage.writeUserFile(accountId, profileId, 'digest.md', markdown);
    } catch (err) {
      this.logger.warn({ event: 'digest.cache_write_failed', err: (err as Error).message }, 'digest cache write failed');
    }
    return { markdown };
  }

  /**
   * Recent staff-assigned lectures (§H3.3) so generated lectures build on the trainer's material.
   * Title + tags + outcome only — no names, no dates (the digest goes to the LLM, P2-5).
   */
  private async assignedRows(profileId: string, now: Date): Promise<AssignedRow[]> {
    const rows = await this.prisma.assignment.findMany({
      where: { profileId, assignedAt: { gte: daysAgo(now, WINDOW_DAYS) } },
      orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }],
      take: MAX_ASSIGNED,
      include: { lecture: { select: { title: true, skillTags: true } } },
    });
    const sessionIds = rows.flatMap((r) => (r.completedAt && r.sessionId ? [r.sessionId] : []));
    const attempts = sessionIds.length
      ? await this.prisma.attempt.findMany({
          where: { sessionId: { in: sessionIds } },
          select: { sessionId: true, isCorrect: true },
        })
      : [];
    const bySession = new Map<string, { n: number; correct: number }>();
    for (const a of attempts) {
      const s = bySession.get(a.sessionId) ?? { n: 0, correct: 0 };
      s.n += 1;
      if (a.isCorrect) s.correct += 1;
      bySession.set(a.sessionId, s);
    }
    return rows.map((r) => {
      const s = r.completedAt && r.sessionId ? bySession.get(r.sessionId) : undefined;
      return {
        title: r.lecture.title,
        skillTags: r.lecture.skillTags,
        completed: r.completedAt !== null,
        correctPct: s && s.n > 0 ? Math.round((s.correct / s.n) * 100) : null,
      };
    });
  }

  /** A few example words from the item bank that drill a skill, for the "Fällig" section. */
  private async examplesFor(skillTag: string): Promise<string[]> {
    const items = await this.prisma.itemBank.findMany({
      where: { skillTags: { has: skillTag } },
      select: { payload: true },
      take: DUE_EXAMPLE_ITEMS,
      orderBy: { difficulty: 'asc' },
    });
    return items
      .map((i) => (i.payload as { word?: unknown } | null)?.word)
      .filter((w): w is string => typeof w === 'string');
  }
}
