import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentActivityService, sessionRollup } from './student-activity.service';
import { ApiException } from '../../common/exceptions/api-exception';
import type { PrismaService } from '../../prisma/prisma.service';

const NOW = new Date('2026-07-25T10:00:00Z');

function make(overrides: Record<string, unknown> = {}) {
  const prisma = {
    profile: {
      findMany: vi.fn(async () => [
        { id: 'p1', name: 'Mia', unlockedUnit: 3, streakDays: 4, lastActive: new Date('2026-07-24T00:00:00Z') },
        { id: 'p2', name: 'Theo', unlockedUnit: 1, streakDays: 0, lastActive: null },
      ]),
      findUnique: vi.fn(async () => ({ id: 'p1' })),
      count: vi.fn(async () => 2),
    },
    session: {
      groupBy: vi.fn(async () => [{ profileId: 'p1', _count: 2 }]),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      count: vi.fn(async () => 0),
    },
    attempt: {
      groupBy: vi.fn(async () => [{ profileId: 'p1', _count: 42 }]),
      findMany: vi.fn(async () => []),
    },
    reviewState: {
      findMany: vi.fn(async () => [{ profileId: 'p1', skillTag: 'vowel_length' }]),
    },
    ...overrides,
  } as unknown as PrismaService;
  return { svc: new StudentActivityService(prisma), prisma };
}

describe('sessionRollup', () => {
  const bank = (over: Partial<Parameters<typeof sessionRollup>[0]> = {}) => ({
    id: 's1',
    source: 'bank',
    itemIds: ['i1', 'i2', 'i3'],
    createdAt: new Date('2026-07-24T09:00:00Z'),
    completedAt: new Date('2026-07-24T09:07:00Z') as Date | null,
    ...over,
  });

  it('summarises a completed bank session: distinct items, attempt-level correct %, active time', () => {
    const r = sessionRollup(bank(), [
      { sessionId: 's1', itemId: 'i1', isCorrect: true, timeMs: 4000 },
      { sessionId: 's1', itemId: 'i2', isCorrect: false, timeMs: 6000 }, // first try wrong …
      { sessionId: 's1', itemId: 'i2', isCorrect: true, timeMs: 3000 }, // … retry right
    ]);
    expect(r).toMatchObject({
      sessionId: 's1',
      abandoned: false,
      itemsTotal: 3,
      itemsAnswered: 2, // i1 + i2 (distinct), i3 untouched
      attemptCount: 3,
      correctPct: 67, // 2/3 attempts, rounded — same semantics as skillBreakdown
      activeMs: 13000,
    });
    expect(r.startedAt).toBe('2026-07-24T09:00:00.000Z');
    expect(r.completedAt).toBe('2026-07-24T09:07:00.000Z');
  });

  it('a bank session without completedAt is abandoned; zero attempts → correctPct null', () => {
    const r = sessionRollup(bank({ completedAt: null }), []);
    expect(r).toMatchObject({ abandoned: true, itemsAnswered: 0, correctPct: null, activeMs: 0 });
  });

  it('homework sessions are terminal, never abandoned: itemIds [] and attempt-count as answered', () => {
    // Created already-decided by review.service: itemIds [], completedAt never set, attempts carry
    // no itemId and timeMs 0.
    const r = sessionRollup(bank({ source: 'homework', itemIds: [], completedAt: null }), [
      { sessionId: 's1', itemId: null, isCorrect: true, timeMs: 0 },
      { sessionId: 's1', itemId: null, isCorrect: false, timeMs: 0 },
    ]);
    expect(r).toMatchObject({ abandoned: false, itemsTotal: 0, itemsAnswered: 2, correctPct: 50, activeMs: 0 });
  });
});

describe('StudentActivityService.directory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists students by name with identity + activity teaser; missing aggregates default to 0', async () => {
    const { svc } = make();
    const { items, nextCursor, total } = await svc.directory(50);
    expect(total).toBe(2);
    expect(nextCursor).toBeNull(); // 2 rows for take 50 → no next page
    expect(items[0]).toMatchObject({
      profileId: 'p1',
      name: 'Mia',
      unit: 3,
      streakDays: 4,
      sessions7d: 2,
      totalAttempts: 42,
    });
    expect(items[0].lastActive).toBe('2026-07-24T00:00:00.000Z');
    // p2 has no aggregate rows at all → zeros, not undefined
    expect(items[1]).toMatchObject({ profileId: 'p2', sessions7d: 0, sessions30d: 0, totalAttempts: 0, weakestSkills: [] });
  });

  it('caps weakestSkills at 3, weakest-first, with due flags', async () => {
    const attempts = [
      // 4 skills with distinct accuracy so the weakest-first order is deterministic
      ...['a', 'a', 'b', 'b', 'c', 'c', 'd', 'd'].map((skill, i) => ({
        profileId: 'p1',
        skillTags: [skill],
        isCorrect: skill === 'd' ? true : skill === 'c' ? i % 2 === 0 : false,
        createdAt: new Date('2026-07-20T00:00:00Z'),
      })),
    ];
    const { svc } = make({
      attempt: { groupBy: vi.fn(async () => []), findMany: vi.fn(async () => attempts) },
    });
    const { items } = await svc.directory(50);
    expect(items[0].weakestSkills).toHaveLength(3);
    expect(items[0].weakestSkills[0].correctPct).toBeLessThanOrEqual(items[0].weakestSkills[1].correctPct);
  });

  it('pages by cursor: take+1 probing yields nextCursor on a full page', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      id: `p${i}`,
      name: `S${i}`,
      unlockedUnit: 1,
      streakDays: 0,
      lastActive: null,
    }));
    const { svc, prisma } = make({
      profile: { findMany: vi.fn(async () => rows), count: vi.fn(async () => 10) },
    });
    const { items, nextCursor } = await svc.directory(2);
    expect(items).toHaveLength(2);
    expect(nextCursor).toBe('p1'); // last item of the page
    expect((prisma.profile.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ take: 3 });
  });
});

describe('StudentActivityService.sessions', () => {
  beforeEach(() => vi.clearAllMocks());

  const sessionRows = [
    { id: 's2', source: 'bank', itemIds: ['i1'], createdAt: new Date('2026-07-24T10:00:00Z'), completedAt: null },
    { id: 's1', source: 'llm', itemIds: ['i2'], createdAt: new Date('2026-07-23T10:00:00Z'), completedAt: new Date('2026-07-23T10:05:00Z') },
  ];

  it('rolls up the page sessions from one attempt fetch; source filter reaches the where', async () => {
    const { svc, prisma } = make({
      session: {
        findMany: vi.fn(async () => sessionRows),
        count: vi.fn(async () => 2),
        groupBy: vi.fn(async () => []),
        findUnique: vi.fn(async () => null),
      },
      attempt: {
        groupBy: vi.fn(async () => []),
        findMany: vi.fn(async () => [{ sessionId: 's1', itemId: 'i2', isCorrect: true, timeMs: 5000 }]),
      },
    });
    const { items, total } = await svc.sessions('p1', { limit: 50, source: 'llm' });
    expect(total).toBe(2);
    expect(items[0]).toMatchObject({ sessionId: 's2', abandoned: true, attemptCount: 0 });
    expect(items[1]).toMatchObject({ sessionId: 's1', abandoned: false, correctPct: 100, activeMs: 5000 });
    expect((prisma.session.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toEqual({
      profileId: 'p1',
      source: 'llm',
    });
  });

  it('404s for an unknown profile', async () => {
    const { svc } = make({ profile: { findUnique: vi.fn(async () => null), findMany: vi.fn(), count: vi.fn() } });
    await expect(svc.sessions('nope', { limit: 50 })).rejects.toMatchObject({ status: 404 });
  });
});

describe('StudentActivityService.sessionDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the summary plus attempts in answer order with retry markers', async () => {
    const { svc, prisma } = make({
      session: {
        findUnique: vi.fn(async () => ({
          id: 's1',
          profileId: 'p1',
          source: 'bank',
          itemIds: ['i1'],
          createdAt: new Date('2026-07-24T09:00:00Z'),
          completedAt: new Date('2026-07-24T09:02:00Z'),
          profile: { name: 'Mia' },
        })),
        findMany: vi.fn(),
        groupBy: vi.fn(),
        count: vi.fn(),
      },
      attempt: {
        groupBy: vi.fn(),
        findMany: vi.fn(async () => [
          { id: 'a1', itemId: 'i1', exerciseType: 'placeholder', prompt: 'Haus?', expected: 'Haus', given: 'Hauss', isCorrect: false, timeMs: 4000, attemptNo: 1, skillTags: ['sp'], createdAt: new Date('2026-07-24T09:00:30Z') },
          { id: 'a2', itemId: 'i1', exerciseType: 'placeholder', prompt: 'Haus?', expected: 'Haus', given: 'Haus', isCorrect: true, timeMs: 2000, attemptNo: 2, skillTags: ['sp'], createdAt: new Date('2026-07-24T09:01:00Z') },
        ]),
      },
    });
    const res = await svc.sessionDetail('p1', 's1');
    expect(res.name).toBe('Mia'); // carried on the payload so the screen needs no separate rollup
    expect(res.attempts.map((a) => a.attemptNo)).toEqual([1, 2]);
    expect(res.attempts[0]).toMatchObject({ given: 'Hauss', isCorrect: false, expected: 'Haus' });
    expect(res.correctPct).toBe(50);
    expect((prisma.attempt.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].orderBy).toEqual([
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
  });

  it('404s when the session belongs to a DIFFERENT profile (path consistency)', async () => {
    const { svc } = make({
      session: {
        findUnique: vi.fn(async () => ({ id: 's1', profileId: 'OTHER', source: 'bank', itemIds: [], createdAt: NOW, completedAt: null })),
        findMany: vi.fn(),
        groupBy: vi.fn(),
        count: vi.fn(),
      },
    });
    await expect(svc.sessionDetail('p1', 's1')).rejects.toBeInstanceOf(ApiException);
  });

  it('404s for an unknown session', async () => {
    const { svc } = make();
    await expect(svc.sessionDetail('p1', 'ghost')).rejects.toMatchObject({ status: 404 });
  });
});
