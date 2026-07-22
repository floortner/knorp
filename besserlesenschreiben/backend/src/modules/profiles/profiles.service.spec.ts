import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfilesService } from './profiles.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { StorageService } from '../../services/storage/storage.service';
import { ApiException } from '../../common/exceptions/api-exception';

function setup(opts: { owned?: boolean } = {}) {
  const prisma = {
    // Ownership check: the profile exists under the caller's account (or not).
    profile: {
      findFirst: vi.fn(async () => (opts.owned === false ? null : { id: 'p1', accountId: 'acc-1' })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'p1', ...data })),
    },
    attempt: { deleteMany: vi.fn(async () => ({ count: 10 })) },
    reviewState: { deleteMany: vi.fn(async () => ({ count: 4 })) },
    session: { deleteMany: vi.fn(async () => ({ count: 2 })) },
    chatMessage: { deleteMany: vi.fn(async () => ({ count: 3 })) },
    homeworkUpload: { deleteMany: vi.fn(async () => ({ count: 2 })) },
    // $transaction runs the array of prisma promises together (mirrors the real batch semantics).
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;
  const storage = { deleteProfileHomework: vi.fn(async () => undefined) } as unknown as StorageService;
  return { svc: new ProfilesService(prisma, storage), prisma, storage };
}

async function statusOf(p: Promise<unknown>): Promise<number | 'ok'> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return (e as ApiException).getStatus();
  }
}

describe('ProfilesService destructive actions (reset / resetChat)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reset wipes attempts, FSRS state and sessions and returns gamification to the start', async () => {
    const { svc, prisma } = setup();
    const p = prisma as unknown as {
      attempt: { deleteMany: ReturnType<typeof vi.fn> };
      reviewState: { deleteMany: ReturnType<typeof vi.fn> };
      session: { deleteMany: ReturnType<typeof vi.fn> };
      profile: { update: ReturnType<typeof vi.fn> };
    };
    await expect(svc.reset('acc-1', 'p1')).resolves.toEqual({ ok: true });
    expect(p.attempt.deleteMany).toHaveBeenCalledWith({ where: { profileId: 'p1' } });
    expect(p.reviewState.deleteMany).toHaveBeenCalledWith({ where: { profileId: 'p1' } });
    expect(p.session.deleteMany).toHaveBeenCalledWith({ where: { profileId: 'p1' } });
    expect(p.profile.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { stars: 0, streakDays: 0, lastActive: null, unlockedUnit: 1 },
    });
  });

  it('resetChat fully wipes the chat — messages, homework rows AND image blobs', async () => {
    const { svc, prisma, storage } = setup();
    const p = prisma as unknown as {
      chatMessage: { deleteMany: ReturnType<typeof vi.fn> };
      homeworkUpload: { deleteMany: ReturnType<typeof vi.fn> };
    };
    const s = storage as unknown as { deleteProfileHomework: ReturnType<typeof vi.fn> };
    await expect(svc.resetChat('acc-1', 'p1')).resolves.toEqual({ ok: true });
    expect(s.deleteProfileHomework).toHaveBeenCalledWith('acc-1', 'p1'); // image blobs erased
    expect(p.chatMessage.deleteMany).toHaveBeenCalledWith({ where: { profileId: 'p1' } });
    expect(p.homeworkUpload.deleteMany).toHaveBeenCalledWith({ where: { profileId: 'p1' } });
  });

  it('resetChat erases storage BEFORE the DB rows (retry-safe ordering)', async () => {
    const order: string[] = [];
    const { svc, prisma, storage } = setup();
    (storage as unknown as { deleteProfileHomework: ReturnType<typeof vi.fn> }).deleteProfileHomework
      .mockImplementation(async () => { order.push('storage'); });
    (prisma as unknown as { $transaction: ReturnType<typeof vi.fn> }).$transaction
      .mockImplementation(async (ops: Promise<unknown>[]) => { order.push('db'); return Promise.all(ops); });
    await svc.resetChat('acc-1', 'p1');
    expect(order).toEqual(['storage', 'db']);
  });

  it('both 404 on a foreign/unknown profile and touch nothing', async () => {
    const { svc, prisma, storage } = setup({ owned: false });
    expect(await statusOf(svc.reset('acc-1', 'p-foreign'))).toBe(404);
    expect(await statusOf(svc.resetChat('acc-1', 'p-foreign'))).toBe(404);
    const p = prisma as unknown as { $transaction: ReturnType<typeof vi.fn> };
    const s = storage as unknown as { deleteProfileHomework: ReturnType<typeof vi.fn> };
    expect(p.$transaction).not.toHaveBeenCalled();
    expect(s.deleteProfileHomework).not.toHaveBeenCalled();
  });
});
