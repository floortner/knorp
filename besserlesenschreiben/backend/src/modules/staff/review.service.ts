import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../services/storage/storage.service';
import { FsrsService } from '../../services/fsrs/fsrs.service';
import { ApiException } from '../../common/exceptions/api-exception';
import { homeworkAnalysisSchema } from '../../contract/staff';
import { Prisma } from '../../generated/prisma/client';
import type { z } from 'zod';
import type { Env } from '../../config/env';
import type { ReviewSubmitInput } from './staff.dto';

type HomeworkAnalysis = z.infer<typeof homeworkAnalysisSchema>;

interface QueueItem {
  uploadId: string;
  profileHandle: string;
  gradeBand: string;
  skillTags: string[];
  imageUrl: string;
  llmAnalysis: HomeworkAnalysis;
  createdAt: string;
}

const MAX_LIMIT = 50;

/**
 * Homework review queue + authoritative apply (ARCHITECTURE §11, SPEC §10). The reviewer's verdict is
 * authoritative: only `reviewed_analysis` ever mutates the learning profile. The queue is PSEUDONYMISED
 * (no child name/email/chat/billing). Reviewer id comes ONLY from the staff JWT, never the request.
 */
@Injectable()
export class ReviewService {
  private readonly logger = new Logger('ReviewService');
  private readonly claimTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly fsrs: FsrsService,
    config: ConfigService<Env, true>,
  ) {
    this.claimTtlMs = config.get('HOMEWORK_REVIEW_CLAIM_TTL', { infer: true }) * 1000;
  }

  /** Stable opaque pseudonym for a profile — never reveals the child's name (ARCHITECTURE §1a). */
  private static handle(profileId: string): string {
    return `L-${createHash('sha256').update(profileId).digest('hex').slice(0, 6)}`;
  }

  /** Pending-review items available to pick up: not claimed, or with an expired lease. Cursor-paged. */
  async queue(limit: number, cursor?: string): Promise<{ items: QueueItem[]; nextCursor: string | null }> {
    const take = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const now = new Date();
    const rows = await this.prisma.homeworkUpload.findMany({
      where: {
        status: 'pending_review',
        OR: [{ claimedBy: null }, { claimedUntil: { lt: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: take + 1, // one extra to know if there's a next page
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { profile: { select: { unlockedUnit: true } } },
    });

    const page = rows.slice(0, take);
    // Parse first (a malformed draft shouldn't break the whole queue — skip it, surface the id for
    // triage), then sign the image URLs concurrently rather than one blocking round-trip per row.
    const valid = page.flatMap((row) => {
      const parsed = homeworkAnalysisSchema.safeParse(row.llmAnalysis);
      if (!parsed.success) {
        this.logger.warn({ event: 'review.draft_unparseable', uploadId: row.id }, 'skipping bad draft');
        return [];
      }
      return [{ row, analysis: parsed.data }];
    });

    const items: QueueItem[] = await Promise.all(
      valid.map(async ({ row, analysis }) => ({
        uploadId: row.id,
        profileHandle: ReviewService.handle(row.profileId),
        gradeBand: `Einheit ${row.profile.unlockedUnit}`,
        skillTags: analysis.suggestedFocus,
        imageUrl: await this.storage.signedHomeworkReadUrl(row.imageKey, this.claimTtlMs / 1000),
        llmAnalysis: analysis,
        createdAt: row.createdAt.toISOString(),
      })),
    );

    const nextCursor = rows.length > take ? page[page.length - 1].id : null;
    return { items, nextCursor };
  }

  /** Soft-lock an item so two reviewers don't grade it twice. 409 if another holds a live lease. */
  async claim(reviewerId: string, uploadId: string): Promise<{ uploadId: string; claimedUntil: string }> {
    const now = new Date();
    const claimedUntil = new Date(now.getTime() + this.claimTtlMs);
    const res = await this.prisma.homeworkUpload.updateMany({
      where: {
        id: uploadId,
        status: 'pending_review',
        OR: [{ claimedBy: null }, { claimedBy: reviewerId }, { claimedUntil: { lt: now } }],
      },
      data: { claimedBy: reviewerId, claimedUntil },
    });
    if (res.count === 0) {
      // Either it doesn't exist / isn't pending, or someone else holds a live lease.
      const exists = await this.prisma.homeworkUpload.findUnique({
        where: { id: uploadId },
        select: { id: true },
      });
      if (!exists) throw new ApiException(404, 'NOT_FOUND', 'Hausübung nicht gefunden.');
      throw new ApiException(409, 'CONFLICT', 'Wird bereits von einer anderen Fachkraft geprüft.');
    }
    this.logger.log({ event: 'review.claimed', reviewerId, uploadId }, 'claimed');
    return { uploadId, claimedUntil: claimedUntil.toISOString() };
  }

  /** Submit the authoritative verdict. approve/correct apply it; reject mutates nothing. */
  async submit(
    reviewerId: string,
    uploadId: string,
    dto: ReviewSubmitInput,
  ): Promise<{ status: 'reviewed' | 'rejected' }> {
    const upload = await this.prisma.homeworkUpload.findUnique({ where: { id: uploadId } });
    if (!upload) throw new ApiException(404, 'NOT_FOUND', 'Hausübung nicht gefunden.');
    if (upload.status !== 'pending_review') {
      throw new ApiException(409, 'CONFLICT', 'Diese Hausübung wurde bereits geprüft.');
    }
    // Only the claimant may submit while a lease is live; once it expires, anyone may take over.
    const leaseLive = upload.claimedUntil !== null && upload.claimedUntil > new Date();
    if (leaseLive && upload.claimedBy && upload.claimedBy !== reviewerId) {
      throw new ApiException(409, 'CONFLICT', 'Wird bereits von einer anderen Fachkraft geprüft.');
    }

    const draft = homeworkAnalysisSchema.safeParse(upload.llmAnalysis);
    if (!draft.success) {
      throw new ApiException(409, 'CONFLICT', 'Analyse-Entwurf fehlt oder ist ungültig.');
    }
    const now = new Date();

    if (dto.decision === 'rejected') {
      await this.prisma.$transaction(async (tx) => {
        // Conditional flip is the authoritative guard against a double-apply: if a concurrent submit
        // (expired-lease takeover, or a double-click) already moved it off pending_review, we win 0 rows
        // and abort before writing a duplicate audit row.
        const won = await tx.homeworkUpload.updateMany({
          where: { id: uploadId, status: 'pending_review' },
          data: {
            status: 'rejected',
            reviewerId,
            reviewDecision: 'rejected',
            reviewedAt: now,
            claimedBy: null,
            claimedUntil: null,
          },
        });
        if (won.count === 0) {
          throw new ApiException(409, 'CONFLICT', 'Diese Hausübung wurde bereits geprüft.');
        }
        await tx.homeworkReview.create({
          data: {
            uploadId,
            reviewerId,
            decision: 'rejected',
            llmAnalysis: draft.data as unknown as Prisma.InputJsonValue,
            agreedWithLlm: false,
            notes: dto.notes,
          },
        });
      });
      this.logger.log({ event: 'homework.reviewed', reviewerId, uploadId, decision: 'rejected' }, 'rejected');
      return { status: 'rejected' };
    }

    // approved | corrected — reviewedAnalysis is guaranteed by the DTO refinement.
    const reviewed = dto.reviewedAnalysis as HomeworkAnalysis;
    const agreedWithLlm = JSON.stringify(reviewed) === JSON.stringify(draft.data);

    await this.prisma.$transaction(async (tx) => {
      // Same conditional-flip guard as the reject path — only one submit may apply to the learning
      // profile, so the homework session / attempts / FSRS nudges are never duplicated.
      const won = await tx.homeworkUpload.updateMany({
        where: { id: uploadId, status: 'pending_review' },
        data: {
          status: 'reviewed',
          reviewedAnalysis: reviewed as unknown as Prisma.InputJsonValue,
          reviewerId,
          reviewDecision: dto.decision,
          reviewedAt: now,
          appliedAt: now,
          claimedBy: null,
          claimedUntil: null,
        },
      });
      if (won.count === 0) {
        throw new ApiException(409, 'CONFLICT', 'Diese Hausübung wurde bereits geprüft.');
      }
      await tx.homeworkReview.create({
        data: {
          uploadId,
          reviewerId,
          decision: dto.decision,
          llmAnalysis: draft.data as unknown as Prisma.InputJsonValue,
          reviewedAnalysis: reviewed as unknown as Prisma.InputJsonValue,
          agreedWithLlm,
          notes: dto.notes,
        },
      });

      // Apply to the learning profile. The per-item rows are the EVIDENCE (homework session, no timing);
      // the professionally-validated `suggestedFocus` is the authoritative SCHEDULING signal — each focus
      // skill is nudged as due so the next session (bank or LLM) drills it (SPEC §8/§10).
      const session = await tx.session.create({
        data: { profileId: upload.profileId, source: 'homework', itemIds: [] },
        select: { id: true },
      });
      for (const item of reviewed.items) {
        await tx.attempt.create({
          data: {
            profileId: upload.profileId,
            sessionId: session.id,
            itemId: null,
            exerciseType: 'homework',
            prompt: item.prompt,
            expected: '',
            given: item.childAnswer,
            isCorrect: item.correct,
            timeMs: 0,
            attemptNo: 1,
            skillTags: item.errorType ? [item.errorType] : [],
          },
        });
      }
      for (const skillTag of reviewed.suggestedFocus) {
        const where = { profileId_skillTag: { profileId: upload.profileId, skillTag } };
        const rs = await tx.reviewState.findUnique({ where });
        const fields = this.fsrs.next(rs, false, 1, now); // homework flagged it → treat as a failed review
        await tx.reviewState.upsert({
          where,
          create: { profileId: upload.profileId, skillTag, ...fields },
          update: fields,
        });
      }
    });

    this.logger.log(
      { event: 'homework.reviewed', reviewerId, uploadId, decision: dto.decision, agreedWithLlm },
      'reviewed',
    );
    return { status: 'reviewed' };
  }
}
