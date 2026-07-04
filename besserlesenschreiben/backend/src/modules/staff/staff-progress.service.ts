import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../common/exceptions/api-exception';
import { daysAgo, startOfUtcWeek } from '../../common/dates';
import { leagueFor } from '../progress/gamification';
import { skillBreakdown } from '../progress/progress.stats';
import { ReviewService } from './review.service';

const ATTEMPT_WINDOW_DAYS = 30; // window for the per-skill accuracy rollup
const HOMEWORK_HISTORY = 10; // most-recent uploads shown

/**
 * Learner progress for the STAFF realm (ADMIN only; controllers gate it). Reuses the family progress
 * math (skillBreakdown / leagueFor) but looks a profile up directly — staff aren't scoped by account
 * ownership. Serves two shapes: identity-bearing per account (Nutzer) and pseudonymised per upload (queue).
 */
@Injectable()
export class StaffProgressService {
  constructor(private readonly prisma: PrismaService) {}

  /** The shared progress payload for one profile (no identity), plus the profile row for the caller. */
  private async forProfile(profileId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) throw new ApiException(404, 'NOT_FOUND', 'Profil nicht gefunden.');
    const now = new Date();

    const [attempts, dueRows, weekStars, totalAttempts, sessions7d, sessions30d, homework] = await Promise.all([
      this.prisma.attempt.findMany({
        where: { profileId, createdAt: { gte: daysAgo(now, ATTEMPT_WINDOW_DAYS) } },
        select: { skillTags: true, isCorrect: true, createdAt: true },
      }),
      this.prisma.reviewState.findMany({ where: { profileId, due: { lte: now } }, select: { skillTag: true } }),
      this.prisma.session.aggregate({
        _sum: { starsAward: true },
        where: { profileId, completedAt: { gte: startOfUtcWeek(now) } },
      }),
      this.prisma.attempt.count({ where: { profileId } }),
      this.prisma.session.count({ where: { profileId, completedAt: { gte: daysAgo(now, 7) } } }),
      this.prisma.session.count({ where: { profileId, completedAt: { gte: daysAgo(now, 30) } } }),
      this.prisma.homeworkUpload.findMany({
        where: { profileId },
        orderBy: { createdAt: 'desc' },
        take: HOMEWORK_HISTORY,
        select: { id: true, createdAt: true, status: true, reviewDecision: true, reviewedAt: true },
      }),
    ]);

    const dueSkills = new Set(dueRows.map((r) => r.skillTag));
    const progress = {
      summary: {
        unit: profile.unlockedUnit,
        streakDays: profile.streakDays,
        stars: profile.stars,
        lastActive: profile.lastActive ? profile.lastActive.toISOString() : null,
        league: leagueFor(weekStars._sum.starsAward ?? 0),
      },
      skills: skillBreakdown(attempts, dueSkills, now).map((s) => ({
        skill: s.skill,
        attempts: s.attempts,
        correctPct: s.correctPct,
        due: s.due,
      })),
      activity: {
        totalAttempts,
        sessions7d,
        sessions30d,
        homework: homework.map((h) => ({
          uploadId: h.id,
          createdAt: h.createdAt.toISOString(),
          status: h.status,
          decision: h.reviewDecision,
          reviewedAt: h.reviewedAt ? h.reviewedAt.toISOString() : null,
        })),
      },
    };
    return { profile, progress };
  }

  /** Identity-bearing: every profile of an account, each with its progress (Nutzer oversight). */
  async forAccount(accountId: string) {
    const profiles = await this.prisma.profile.findMany({
      where: { accountId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const withProgress = await Promise.all(
      profiles.map(async (p) => {
        const { profile, progress } = await this.forProfile(p.id);
        return { profileId: profile.id, name: profile.name, ...progress };
      }),
    );
    return { profiles: withProgress };
  }

  /** Pseudonymised: the upload's learner by opaque handle only — never a name (review context). */
  async forUpload(uploadId: string) {
    const upload = await this.prisma.homeworkUpload.findUnique({
      where: { id: uploadId },
      select: { profileId: true },
    });
    if (!upload) throw new ApiException(404, 'NOT_FOUND', 'Upload nicht gefunden.');
    const { profile, progress } = await this.forProfile(upload.profileId);
    return { profileHandle: ReviewService.handle(profile.id), ...progress };
  }
}
