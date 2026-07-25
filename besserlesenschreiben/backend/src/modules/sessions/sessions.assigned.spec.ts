import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionsService } from './sessions.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { LlmService } from '../../services/llm/llm.service';
import type { DigestService } from '../../services/digest/digest.service';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { ApiException } from '../../common/exceptions/api-exception';

const ITEMS = [
  { id: 'i2', exerciseType: 'placeholder', payload: { prompt: 'B?', options: ['x', 'y'], answer: 'x', praise: 'Toll!' }, audioUrl: null, syllableAudio: null, skillTags: ['placeholder'] },
  { id: 'i1', exerciseType: 'placeholder', payload: { prompt: 'A?', options: ['x', 'y'], answer: 'y', praise: 'Super!' }, audioUrl: null, syllableAudio: null, skillTags: ['placeholder'] },
];

function setup(opts: { assignment?: Record<string, unknown> | null } = {}) {
  const assignment =
    opts.assignment === undefined
      ? {
          id: 'as-1',
          profileId: 'p1',
          sessionId: null,
          completedAt: null,
          lecture: { id: 'l1', intro: 'Merke: Erst lesen, dann klatschen!', itemIds: ['i1', 'i2'] },
        }
      : opts.assignment;
  const updates: Array<Record<string, unknown>> = [];
  const prisma = {
    profile: { findFirst: vi.fn(async () => ({ id: 'p1', accountId: 'a1', unlockedUnit: 1 })) },
    assignment: {
      findFirst: vi.fn(async () => assignment),
      update: vi.fn(async (args: Record<string, unknown>) => {
        updates.push(args);
        return {};
      }),
    },
    itemBank: { findMany: vi.fn(async () => ITEMS) },
    session: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'ses-9',
        createdAt: new Date('2026-07-25T12:00:00Z'),
        ...data,
      })),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
  } as unknown as PrismaService;
  const llm = { available: false } as unknown as LlmService;
  const digest = { generate: vi.fn() } as unknown as DigestService;
  const config = { get: () => 5 } as unknown as ConfigService<Env, true>;
  return { svc: new SessionsService(prisma, llm, digest, config), prisma, updates };
}

describe('SessionsService.createAssigned', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serves the lecture items in lecture order with the Merksatz intro, and links the session', async () => {
    const { svc, updates } = setup();
    const res = await svc.createAssigned('a1', { profileId: 'p1', source: 'assigned', assignmentId: 'as-1' });
    // itemIds order i1,i2 wins over the DB fetch order (which returned i2 first)
    expect(res.items.map((i) => i.id)).toEqual(['i1', 'i2']);
    expect(res.intro).toBe('Merke: Erst lesen, dann klatschen!');
    expect(res.sessionId).toBe('ses-9');
    expect(res).not.toHaveProperty('unit', expect.anything());
    // restart-or-start always re-links the assignment to the fresh session
    expect(updates[0]).toMatchObject({ where: { id: 'as-1' }, data: { sessionId: 'ses-9' } });
  });

  it('404s a foreign or unknown assignment (selector never reveals existence)', async () => {
    const { svc } = setup({ assignment: null });
    await expect(
      svc.createAssigned('a1', { profileId: 'p1', source: 'assigned', assignmentId: 'ghost' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('409s an already-completed assignment', async () => {
    const { svc } = setup({
      assignment: { id: 'as-1', profileId: 'p1', sessionId: 's-old', completedAt: new Date(), lecture: { itemIds: ['i1'], intro: 'x' } },
    });
    await expect(
      svc.createAssigned('a1', { profileId: 'p1', source: 'assigned', assignmentId: 'as-1' }),
    ).rejects.toBeInstanceOf(ApiException);
  });
});

describe('SessionsService.complete — assignment linkage', () => {
  beforeEach(() => vi.clearAllMocks());

  function completeSetup(sessionRow: Record<string, unknown>) {
    const txCalls: unknown[] = [];
    const prisma = {
      session: {
        findUnique: vi.fn(async () => sessionRow),
        update: vi.fn(async () => ({})),
        aggregate: vi.fn(async () => ({ _sum: { starsAward: 0 } })),
      },
      profile: {
        findFirst: vi.fn(async () => ({
          id: 'p1', accountId: 'a1', stars: 0, streakDays: 0, lastActive: null, jokerUsedWeek: null, unlockedUnit: 1,
        })),
        update: vi.fn(async () => ({})),
      },
      assignment: { updateMany: vi.fn(async () => ({ count: 1 })) },
      $transaction: vi.fn(async (ops: unknown[]) => {
        txCalls.push(...ops);
        return [];
      }),
    } as unknown as PrismaService;
    const svc = new SessionsService(
      prisma,
      { available: false } as unknown as LlmService,
      { generate: vi.fn() } as unknown as DigestService,
      { get: () => 5 } as unknown as ConfigService<Env, true>,
    );
    return { svc, prisma };
  }

  it('marks the linked assignment completed inside the completion transaction', async () => {
    const { svc, prisma } = completeSetup({ id: 'ses-9', profileId: 'p1', unit: null, completedAt: null, starsAward: null });
    await svc.complete('a1', 'ses-9');
    expect(prisma.assignment.updateMany).toHaveBeenCalledWith({
      where: { sessionId: 'ses-9' },
      data: { completedAt: expect.any(Date) },
    });
  });

  it('does NOT touch assignments again on an idempotent re-complete', async () => {
    const { svc, prisma } = completeSetup({ id: 'ses-9', profileId: 'p1', unit: null, completedAt: new Date(), starsAward: 5 });
    await svc.complete('a1', 'ses-9');
    expect(prisma.assignment.updateMany).not.toHaveBeenCalled();
  });
});
