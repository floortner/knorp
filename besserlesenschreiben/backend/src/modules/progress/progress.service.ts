import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { assertProfileOwned } from '../../common/ownership';
import { daysAgo, startOfUtcWeek } from '../../common/dates';
import { leagueFor } from './gamification';
import { monthlyHeatmap, skillBreakdown, weeklyActivity } from './progress.stats';

const HEATMAP_WINDOW_DAYS = 30;

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /progress/:profileId — streak, stars, activity windows, league, and per-skill breakdown. */
  async get(accountId: string, profileId: string) {
    const profile = await assertProfileOwned(this.prisma, accountId, profileId);
    const now = new Date();

    const attempts = await this.prisma.attempt.findMany({
      where: { profileId, createdAt: { gte: daysAgo(now, HEATMAP_WINDOW_DAYS) } },
      select: { skillTags: true, isCorrect: true, createdAt: true },
    });
    const dueRows = await this.prisma.reviewState.findMany({
      where: { profileId, due: { lte: now } },
      select: { skillTag: true },
    });
    const dueSkills = new Set(dueRows.map((r) => r.skillTag));

    const weekStars = await this.prisma.session.aggregate({
      _sum: { starsAward: true },
      where: { profileId, completedAt: { gte: startOfUtcWeek(now) } },
    });

    return {
      streakDays: profile.streakDays,
      stars: profile.stars,
      weeklyActivity: weeklyActivity(attempts, now),
      monthlyHeatmap: monthlyHeatmap(attempts, now),
      league: leagueFor(weekStars._sum.starsAward ?? 0),
      skillBreakdown: skillBreakdown(attempts, dueSkills, now),
    };
  }
}
