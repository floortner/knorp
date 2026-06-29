import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../common/exceptions/api-exception';
import { assertProfileOwned } from '../../common/ownership';
import { daysAgo, startOfUtcDay, startOfUtcWeek } from '../../common/dates';
import { STARS_PER_SESSION, leagueFor, nextStreak, type League } from '../progress/gamification';
import { toExercise } from './exercise.mapper';
import { selectBankItems, weakSkills } from './session-select';
import { UNIT_CATALOG, unitStatus } from './units.catalog';
import type { CreateSessionInput } from './sessions.dto';

const RECENT_WINDOW_DAYS = 14;
const RECENT_ATTEMPT_LIMIT = 200;

@Injectable()
export class SessionsService {
  private readonly logger = new Logger('SessionsService');

  constructor(private readonly prisma: PrismaService) {}

  /** GET /units — the catalogue with live per-profile status + item counts. */
  async units(accountId: string, profileId?: string) {
    const profile = profileId
      ? await assertProfileOwned(this.prisma, accountId, profileId)
      : await this.prisma.profile.findFirst({ where: { accountId }, orderBy: { createdAt: 'asc' } });
    const unlocked = profile?.unlockedUnit ?? 1;

    const counts = await this.prisma.itemBank.groupBy({ by: ['unit'], _count: { _all: true } });
    const countByUnit = new Map(counts.map((c) => [c.unit, c._count._all]));

    return UNIT_CATALOG.map((u) => ({
      unit: u.unit,
      title: u.title,
      subtitle: u.subtitle,
      focus: u.focus,
      exerciseTypes: u.exerciseTypes,
      itemCount: countByUnit.get(u.unit) ?? 0,
      status: unitStatus(u.unit, unlocked),
      theme: u.theme,
    }));
  }

  /**
   * POST /sessions — generate a deterministic bank session (SPEC §8A). Zero LLM calls: the DB decides
   * what to drill from recent weakness + FSRS-due skills, the item bank supplies the content.
   */
  async createBank(accountId: string, dto: CreateSessionInput) {
    const profile = await assertProfileOwned(this.prisma, accountId, dto.profileId);
    const unit = dto.unit ?? profile.unlockedUnit;
    if (unit > profile.unlockedUnit) {
      throw new ApiException(403, 'UNIT_LOCKED', 'Diese Einheit ist noch gesperrt.');
    }

    const items = await this.prisma.itemBank.findMany({ where: { unit } });
    if (items.length === 0) {
      throw new ApiException(404, 'NO_ITEMS', 'Für diese Einheit gibt es noch keine Übungen.');
    }

    const now = new Date();
    const recent = await this.prisma.attempt.findMany({
      where: { profileId: profile.id, createdAt: { gte: daysAgo(now, RECENT_WINDOW_DAYS) } },
      select: { skillTags: true, isCorrect: true, timeMs: true },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ATTEMPT_LIMIT,
    });
    const due = await this.prisma.reviewState.findMany({
      where: { profileId: profile.id, due: { lte: now } },
      select: { skillTag: true },
    });
    const priority = new Set<string>([...weakSkills(recent), ...due.map((d) => d.skillTag)]);

    const selected = selectBankItems(items, priority);
    const session = await this.prisma.session.create({
      data: { profileId: profile.id, unit, itemIds: selected.map((i) => i.id), source: 'bank' },
    });

    this.logger.log(
      { event: 'session.created', sessionId: session.id, unit, items: selected.length, prioritised: priority.size },
      'bank session generated',
    );

    return {
      sessionId: session.id,
      profileId: profile.id,
      unit,
      generatedAt: session.createdAt,
      items: selected.map(toExercise),
    };
  }

  /**
   * POST /sessions/:id/complete — award stars, advance the streak, return the league standing.
   * Idempotent: a second call returns the already-recorded standing without double-awarding.
   */
  async complete(accountId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new ApiException(404, 'NOT_FOUND', 'Session nicht gefunden.');
    const profile = await assertProfileOwned(this.prisma, accountId, session.profileId);
    const now = new Date();

    if (session.completedAt) {
      return {
        starsAwarded: session.starsAward ?? 0,
        streakDays: profile.streakDays,
        league: await this.weeklyLeague(profile.id, now),
      };
    }

    const stars = STARS_PER_SESSION;
    const streakDays = nextStreak(profile.lastActive, now, profile.streakDays);
    const shouldUnlock = session.unit === profile.unlockedUnit && profile.unlockedUnit < UNIT_CATALOG.length;
    const profileUpdate = {
      stars: { increment: stars },
      streakDays,
      lastActive: startOfUtcDay(now),
      ...(shouldUnlock ? { unlockedUnit: { increment: 1 } } : {}),
    };
    await this.prisma.$transaction([
      this.prisma.session.update({ where: { id: sessionId }, data: { completedAt: now, starsAward: stars } }),
      this.prisma.profile.update({ where: { id: profile.id }, data: profileUpdate }),
    ]);

    if (shouldUnlock) {
      this.logger.log(
        { event: 'session.unit_unlocked', unlockedUnit: profile.unlockedUnit + 1 },
        'next unit unlocked',
      );
    }
    this.logger.log({ event: 'session.completed', sessionId, stars, streakDays }, 'session completed');
    return { starsAwarded: stars, streakDays, league: await this.weeklyLeague(profile.id, now) };
  }

  /** League from stars earned since Monday this week (sum of completed sessions' awards). */
  private async weeklyLeague(profileId: string, now: Date): Promise<League> {
    const agg = await this.prisma.session.aggregate({
      _sum: { starsAward: true },
      where: { profileId, completedAt: { gte: startOfUtcWeek(now) } },
    });
    return leagueFor(agg._sum.starsAward ?? 0);
  }
}
