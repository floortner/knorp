import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewService } from './review.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { StorageService } from '../../services/storage/storage.service';
import type { FsrsService } from '../../services/fsrs/fsrs.service';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { ApiException } from '../../common/exceptions/api-exception';

const analysis = {
  topic: 'Anlaute',
  exerciseType: 'fixvowel',
  items: [{ prompt: 'Apfel', childAnswer: 'Apfel', correct: true, errorType: null }],
  suggestedFocus: ['vowel_length', 'dehnung_h'],
};

function setup(overrides: {
  uploadRow?: Record<string, unknown> | null;
  findMany?: unknown[];
  updateManyCount?: number;
} = {}) {
  const calls = {
    sessionCreate: vi.fn(async () => ({ id: 'ses-1' })),
    attemptCreate: vi.fn(async () => ({})),
    reviewStateFind: vi.fn(async () => null),
    reviewStateUpsert: vi.fn(async () => ({})),
    reviewCreate: vi.fn(async () => ({})),
    uploadUpdate: vi.fn(async () => ({})),
  };

  const prisma = {
    homeworkUpload: {
      findMany: vi.fn(async () => overrides.findMany ?? []),
      findUnique: vi.fn(async () => overrides.uploadRow ?? null),
      updateMany: vi.fn(async () => ({ count: overrides.updateManyCount ?? 1 })),
      update: calls.uploadUpdate,
    },
    homeworkReview: { create: calls.reviewCreate },
    session: { create: calls.sessionCreate },
    attempt: { create: calls.attemptCreate },
    reviewState: { findUnique: calls.reviewStateFind, upsert: calls.reviewStateUpsert },
    // Support both forms used by the service: array of promises, and a callback receiving `tx`.
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as Promise<unknown>[]),
    ),
  } as unknown as PrismaService;

  const storage = {
    signedHomeworkReadUrl: vi.fn(async () => 'https://example.test/sas'),
  } as unknown as StorageService;
  const fsrs = {
    next: vi.fn(() => ({ stability: 1, difficulty: 1, state: 1, reps: 1, lapses: 1, learningSteps: 0, elapsedDays: 0, scheduledDays: 0, due: new Date(), lastReview: new Date() })),
  } as unknown as FsrsService;
  const config = { get: () => 900 } as unknown as ConfigService<Env, true>;

  return { svc: new ReviewService(prisma, storage, fsrs, config), prisma, calls };
}

async function statusOf(p: Promise<unknown>): Promise<number | 'ok'> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return (e as ApiException).getStatus();
  }
}

describe('ReviewService.queue (pseudonymisation)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exposes an opaque handle + coarse band, never a child name', async () => {
    const { svc } = setup({
      findMany: [
        { id: 'up-1', profileId: 'prof-1234', imageKey: 'k', createdAt: new Date('2026-06-29T10:00:00Z'), llmAnalysis: analysis, profile: { unlockedUnit: 3 } },
      ],
    });
    const { items, nextCursor } = await svc.queue(50);
    expect(items).toHaveLength(1);
    expect(items[0].profileHandle).toMatch(/^L-[0-9a-f]{6}$/);
    expect(items[0].profileHandle).not.toContain('prof-1234');
    expect(items[0].gradeBand).toBe('Einheit 3');
    expect(items[0].skillTags).toEqual(['vowel_length', 'dehnung_h']);
    expect(items[0].imageUrl).toBe('https://example.test/sas');
    expect(JSON.stringify(items[0])).not.toMatch(/name|email/i);
    expect(nextCursor).toBeNull();
  });
});

describe('ReviewService.claim', () => {
  beforeEach(() => vi.clearAllMocks());

  it('409s when another reviewer holds a live lease', async () => {
    const { svc } = setup({ updateManyCount: 0, uploadRow: { id: 'up-1' } });
    expect(await statusOf(svc.claim('rev-1', 'up-1'))).toBe(409);
  });

  it('returns the lease on a successful claim', async () => {
    const { svc } = setup({ updateManyCount: 1 });
    await expect(svc.claim('rev-1', 'up-1')).resolves.toMatchObject({ uploadId: 'up-1' });
  });
});

describe('ReviewService.submit', () => {
  beforeEach(() => vi.clearAllMocks());

  const claimedByMe = {
    id: 'up-1',
    profileId: 'prof-1',
    status: 'pending_review',
    claimedBy: 'rev-1',
    claimedUntil: new Date(Date.now() + 60_000),
    llmAnalysis: analysis,
  };

  it('reject mutates nothing in the learning profile', async () => {
    const { svc, calls } = setup({ uploadRow: claimedByMe });
    await expect(svc.submit('rev-1', 'up-1', { decision: 'rejected' })).resolves.toEqual({ status: 'rejected' });
    expect(calls.reviewCreate).toHaveBeenCalledOnce();
    expect(calls.sessionCreate).not.toHaveBeenCalled();
    expect(calls.attemptCreate).not.toHaveBeenCalled();
    expect(calls.reviewStateUpsert).not.toHaveBeenCalled();
  });

  it('approve/correct applies the reviewed focus to review_state and records the verdict', async () => {
    const { svc, calls } = setup({ uploadRow: claimedByMe });
    const res = await svc.submit('rev-1', 'up-1', { decision: 'corrected', reviewedAnalysis: analysis });
    expect(res).toEqual({ status: 'reviewed' });
    expect(calls.sessionCreate).toHaveBeenCalledOnce();
    expect(calls.attemptCreate).toHaveBeenCalledTimes(analysis.items.length);
    expect(calls.reviewStateUpsert).toHaveBeenCalledTimes(analysis.suggestedFocus.length);
  });

  it('409s when a different reviewer holds a live lease', async () => {
    const { svc } = setup({
      uploadRow: { ...claimedByMe, claimedBy: 'rev-2' },
    });
    expect(await statusOf(svc.submit('rev-1', 'up-1', { decision: 'rejected' }))).toBe(409);
  });

  it('409s when the upload was already reviewed', async () => {
    const { svc } = setup({ uploadRow: { ...claimedByMe, status: 'reviewed' } });
    expect(await statusOf(svc.submit('rev-1', 'up-1', { decision: 'rejected' }))).toBe(409);
  });

  it('409s and applies nothing when a concurrent submit already won the conditional flip', async () => {
    // Pre-checks pass (still pending_review) but the in-transaction conditional update wins 0 rows
    // because a racing submit flipped the status first — the apply must abort, not double-write.
    const { svc, calls } = setup({ uploadRow: claimedByMe, updateManyCount: 0 });
    expect(await statusOf(svc.submit('rev-1', 'up-1', { decision: 'corrected', reviewedAnalysis: analysis }))).toBe(409);
    expect(calls.reviewCreate).not.toHaveBeenCalled();
    expect(calls.sessionCreate).not.toHaveBeenCalled();
    expect(calls.attemptCreate).not.toHaveBeenCalled();
    expect(calls.reviewStateUpsert).not.toHaveBeenCalled();
  });
});
