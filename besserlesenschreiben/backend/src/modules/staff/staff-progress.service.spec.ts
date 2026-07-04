import { describe, it, expect, vi } from 'vitest';
import { StaffProgressService } from './staff-progress.service';
import type { PrismaService } from '../../prisma/prisma.service';

function make() {
  const profile = {
    id: 'prof-1',
    name: 'Mia',
    accountId: 'a1',
    unlockedUnit: 3,
    streakDays: 4,
    stars: 120,
    lastActive: new Date('2026-07-01T00:00:00Z'),
  };
  const prisma = {
    profile: {
      findUnique: vi.fn(async () => profile),
      findMany: vi.fn(async () => [{ id: 'prof-1' }]),
    },
    attempt: { findMany: vi.fn(async () => []), count: vi.fn(async () => 42) },
    reviewState: { findMany: vi.fn(async () => [{ skillTag: 'dehnung_h' }]) },
    session: { aggregate: vi.fn(async () => ({ _sum: { starsAward: 30 } })), count: vi.fn(async () => 2) },
    homeworkUpload: {
      findUnique: vi.fn(async () => ({ profileId: 'prof-1' })),
      findMany: vi.fn(async () => []),
    },
  } as unknown as PrismaService;
  return { svc: new StaffProgressService(prisma) };
}

describe('StaffProgressService', () => {
  it('forUpload is PSEUDONYMISED: an opaque handle, never a name (rule 10)', async () => {
    const { svc } = make();
    const res = await svc.forUpload('up-1');
    expect(res.profileHandle).toMatch(/^L-[0-9a-f]{6}$/);
    // The child's real name must never leak through the queue surface.
    expect(JSON.stringify(res)).not.toMatch(/Mia/);
    expect('name' in res).toBe(false);
    expect(res.summary.unit).toBe(3);
    expect(res.summary.league.tier).toBe('bronze');
    expect(res.activity.totalAttempts).toBe(42);
  });

  it('forAccount is identity-bearing: includes each child name (Nutzer oversight)', async () => {
    const { svc } = make();
    const res = await svc.forAccount('a1');
    expect(res.profiles).toHaveLength(1);
    expect(res.profiles[0]).toMatchObject({ profileId: 'prof-1', name: 'Mia' });
    expect(res.profiles[0].summary.streakDays).toBe(4);
  });
});
