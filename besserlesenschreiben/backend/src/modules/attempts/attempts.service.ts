import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../common/exceptions/api-exception';
import { assertProfileOwned } from '../../common/ownership';
import { FsrsService } from '../../services/fsrs/fsrs.service';
import { Prisma } from '../../generated/prisma/client';
import type { CreateAttemptInput } from './attempts.dto';

@Injectable()
export class AttemptsService {
  private readonly logger = new Logger('AttemptsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly fsrs: FsrsService,
  ) {}

  /**
   * POST /attempts — thin, idempotent telemetry insert that also advances FSRS scheduling for each
   * drilled skill (SPEC §6/§8). Idempotent on (sessionId, itemId, attemptNo): a duplicate emit (offline
   * replay, retry) is a no-op and never double-counts a review. `profileId` is taken from the session,
   * never the client. We never log prompt/expected/given (child-answer content).
   */
  async record(accountId: string, dto: CreateAttemptInput): Promise<{ ok: true }> {
    const session = await this.prisma.session.findUnique({
      where: { id: dto.sessionId },
      select: { id: true, profileId: true },
    });
    if (!session) throw new ApiException(404, 'NOT_FOUND', 'Session nicht gefunden.');
    await assertProfileOwned(this.prisma, accountId, session.profileId);

    const attemptNo = dto.attemptNo ?? 1;
    const itemId = dto.itemId ?? null;

    // Fast idempotency pre-check (the functional unique index is the race backstop below).
    const existing = await this.prisma.attempt.findFirst({
      where: { sessionId: dto.sessionId, itemId, attemptNo },
      select: { id: true },
    });
    if (existing) return { ok: true };

    const now = new Date();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.attempt.create({
          data: {
            profileId: session.profileId,
            sessionId: dto.sessionId,
            itemId,
            exerciseType: dto.exerciseType,
            prompt: dto.prompt,
            expected: dto.expected,
            given: dto.given,
            isCorrect: dto.isCorrect,
            timeMs: dto.timeMs,
            attemptNo,
            skillTags: dto.skillTags,
          },
        });
        // Schedule one review per skill the item drilled (SPEC §8: per skill_tag, not per word).
        for (const skillTag of dto.skillTags) {
          const where = { profileId_skillTag: { profileId: session.profileId, skillTag } };
          const rs = await tx.reviewState.findUnique({ where });
          const fields = this.fsrs.next(rs, dto.isCorrect, attemptNo, now);
          await tx.reviewState.upsert({
            where,
            create: { profileId: session.profileId, skillTag, ...fields },
            update: fields,
          });
        }
      });
    } catch (err) {
      // Lost the race on the functional unique index → another emit already recorded it. Idempotent.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { ok: true };
      throw err;
    }

    this.logger.log(
      { event: 'attempt.recorded', sessionId: dto.sessionId, isCorrect: dto.isCorrect, skills: dto.skillTags.length },
      'attempt recorded',
    );
    return { ok: true };
  }
}
