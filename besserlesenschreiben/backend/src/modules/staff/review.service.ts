import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../services/storage/storage.service';
import { FsrsService } from '../../services/fsrs/fsrs.service';
import { ApiException } from '../../common/exceptions/api-exception';
import { homeworkAnalysisSchema } from '../../contract/staff';
import { SKILL_TAG_SET, SKILL_TAGS } from '../../contract/skills';
import { Prisma } from '../../generated/prisma/client';
import type { z } from 'zod';
import type { Env } from '../../config/env';
import type { ReviewSubmitInput } from './staff.dto';

type HomeworkAnalysis = z.infer<typeof homeworkAnalysisSchema>;

const MAX_APPLIED_TAGS = 20;
// While the skill taxonomy is being redesigned it is a single 'placeholder' — filtering strictly against
// it would drop every homework focus tag and neuter scheduling. Enum-filtering therefore auto-activates
// only once a real taxonomy is populated; until then we still trim/bound/dedupe (security review P2-4).
const TAXONOMY_ACTIVE = !(SKILL_TAGS.length === 1 && SKILL_TAG_SET.has('placeholder'));

/**
 * Sanitise reviewed skill tags before they become scheduling keys: trim, drop empties/over-long strings,
 * dedupe, cap the count, and — once the taxonomy is real — keep only known tags so an injected or
 * hallucinated string from the photo can't become a permanent scheduling key (security review P2-4).
 */
function normalizeSkillTags(tags: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const t = raw.trim();
    if (!t || t.length > 64 || seen.has(t)) continue;
    if (TAXONOMY_ACTIVE && !SKILL_TAG_SET.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_APPLIED_TAGS) break;
  }
  return out;
}

interface QueueItem {
  uploadId: string;
  profileHandle: string;
  gradeBand: string;
  skillTags: string[];
  imageUrl: string;
  llmAnalysis: HomeworkAnalysis;
  createdAt: string;
  claimed: boolean;
  decision: string | null;
  reviewedAt: string | null;
  reviewedAnalysis: HomeworkAnalysis | null;
  notes: string | null;
}

/** Which slice of the review pipeline to list. */
export type QueueFilter = 'open' | 'done' | 'all';

/**
 * The where + ordering for a queue slice. `id` is the last orderBy key so cursor:{id} paging is stable
 * even when the primary sort key (createdAt/reviewedAt) ties.
 */
function queueQuery(
  filter: QueueFilter,
): { where: Prisma.HomeworkUploadWhereInput; orderBy: Prisma.HomeworkUploadOrderByWithRelationInput[] } {
  switch (filter) {
    case 'done':
      return { where: { status: { in: ['reviewed', 'rejected'] } }, orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }] };
    case 'all':
      return { where: {}, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] };
    default:
      // open: ALL undecided items, oldest-first (FIFO). Live-claimed rows are included and flagged
      // `claimed` (in Prüfung) so other reviewers see work in progress instead of items vanishing.
      return {
        where: { status: 'pending_review' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      };
  }
}

const MAX_LIMIT = 50;

/**
 * Homework review queue + authoritative apply (ARCHITECTURE §11, SPEC §10). The reviewer's verdict is
 * authoritative: only `reviewed_analysis` ever mutates the learning profile. The queue is PSEUDONYMISED
 * (no student name/email/chat/billing). Reviewer id comes ONLY from the staff JWT, never the request.
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

  /** Stable opaque pseudonym for a profile — never reveals the student's name (ARCHITECTURE §1a). */
  static handle(profileId: string): string {
    return `L-${createHash('sha256').update(profileId).digest('hex').slice(0, 6)}`;
  }

  /**
   * List review items. `open` = every undecided item, oldest-first — the live queue, with live-claimed
   * rows flagged `claimed` (in Prüfung by someone else). `done` = already-actioned (reviewed/rejected),
   * newest-first — the history, carrying the verdict (`reviewedAnalysis`/`notes`) for the read-only
   * detail view. `all` = everything. Every row stays PSEUDONYMISED. Cursor-paged, with a total.
   */
  async queue(
    reviewerId: string,
    limit: number,
    cursor?: string,
    filter: QueueFilter = 'open',
  ): Promise<{ items: QueueItem[]; nextCursor: string | null; total: number }> {
    const take = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const now = new Date();
    const { where, orderBy } = queueQuery(filter);
    const [rows, total] = await Promise.all([
      this.prisma.homeworkUpload.findMany({
        where,
        orderBy,
        take: take + 1, // one extra to know if there's a next page
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          profile: { select: { unlockedUnit: true } },
          // Latest review's student-visible comment — surfaced on historical rows only.
          reviews: { orderBy: { createdAt: 'desc' }, take: 1, select: { notes: true } },
        },
      }),
      this.prisma.homeworkUpload.count({ where }),
    ]);

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
      valid.map(async ({ row, analysis }) => {
        const reviewed = homeworkAnalysisSchema.safeParse(row.reviewedAnalysis);
        return {
          uploadId: row.id,
          profileHandle: ReviewService.handle(row.profileId),
          gradeBand: `Einheit ${row.profile.unlockedUnit}`,
          skillTags: analysis.suggestedFocus,
          imageUrl: await this.storage.signedHomeworkReadUrl(row.imageKey, this.claimTtlMs / 1000),
          llmAnalysis: analysis,
          createdAt: row.createdAt.toISOString(),
          // In Prüfung by ANOTHER reviewer (live lease). Own claims stay actionable (re-openable).
          claimed: row.claimedBy != null && row.claimedBy !== reviewerId &&
            row.claimedUntil != null && row.claimedUntil > now,
          decision: row.reviewDecision ?? null,
          reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
          reviewedAnalysis: reviewed.success ? reviewed.data : null,
          notes: row.reviews?.[0]?.notes ?? null,
        };
      }),
    );

    const nextCursor = rows.length > take ? page[page.length - 1].id : null;
    return { items, nextCursor, total };
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
  /**
   * Release the caller's own claim (leaving the review screen without a verdict). Only clears the lease
   * if THIS reviewer holds it and the item is still pending — releasing after a submit or a takeover is a
   * harmless no-op. Idempotent.
   */
  async release(reviewerId: string, uploadId: string): Promise<{ ok: true }> {
    await this.prisma.homeworkUpload.updateMany({
      where: { id: uploadId, claimedBy: reviewerId, status: 'pending_review' },
      data: { claimedBy: null, claimedUntil: null },
    });
    return { ok: true };
  }

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
      // Each homework item is a distinct evidence row in the same session with itemId=null. The attempt
      // unique index keys on (session_id, COALESCE(item_id, sentinel), attempt_no), so a shared attemptNo
      // collapses every null-item row onto one key → P2002 on the 2nd item. Index them to stay distinct.
      for (const [i, item] of reviewed.items.entries()) {
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
            attemptNo: i + 1,
            skillTags: item.errorType ? normalizeSkillTags([item.errorType]) : [],
          },
        });
      }
      for (const skillTag of normalizeSkillTags(reviewed.suggestedFocus)) {
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
