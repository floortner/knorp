import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JwtService } from '@nestjs/jwt';
import { ParentService } from './parent.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { StorageService } from '../../services/storage/storage.service';
import { ApiException } from '../../common/exceptions/api-exception';

// argon2.verify returns true iff the supplied pin equals the stored "hash" (which we set to the pin).
vi.mock('argon2', () => ({
  hash: vi.fn(async (pin: string) => pin),
  verify: vi.fn(async (hash: string, pin: string) => hash === pin),
}));

interface AccountRow {
  id: string;
  parentPinHash: string | null;
  pinAttempts: number;
  pinLockedUntil: Date | null;
}

function setup(initial: Partial<AccountRow> = {}) {
  const row: AccountRow = {
    id: 'acc-1',
    parentPinHash: '1234',
    pinAttempts: 0,
    pinLockedUntil: null,
    ...initial,
  };
  const prisma = {
    account: {
      findUnique: vi.fn(async () => ({ ...row })),
      update: vi.fn(async ({ data }: { data: Partial<AccountRow> }) => {
        Object.assign(row, data);
        return { ...row };
      }),
    },
    // verify-pin now binds the token to a child → it checks ownership first.
    profile: { findFirst: vi.fn(async () => ({ id: 'p1', accountId: 'acc-1' })) },
    chatMessage: { deleteMany: vi.fn(async () => ({ count: 3 })) },
    homeworkUpload: { deleteMany: vi.fn(async () => ({ count: 2 })) },
    // $transaction runs the array of prisma promises together (mirrors the real batch semantics).
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;
  const jwt = { signAsync: vi.fn(async () => 'parent-token') } as unknown as JwtService;
  const storage = { deleteProfileHomework: vi.fn(async () => undefined) } as unknown as StorageService;
  return { svc: new ParentService(prisma, jwt, storage), row, prisma, storage };
}

async function statusOf(p: Promise<unknown>): Promise<number | 'ok'> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return (e as ApiException).getStatus();
  }
}

describe('ParentService durable PIN lockout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a parent token on the correct PIN', async () => {
    const { svc } = setup();
    await expect(svc.verifyPin('acc-1', '1234', 'p1')).resolves.toEqual({ parentToken: 'parent-token' });
  });

  it('locks out (429) after 5 wrong attempts and blocks the correct PIN during the window', async () => {
    const { svc, row } = setup();
    for (let i = 0; i < 4; i++) {
      expect(await statusOf(svc.verifyPin('acc-1', '0000', 'p1'))).toBe(403);
    }
    expect(row.pinAttempts).toBe(4);
    // 5th wrong attempt trips the lock
    expect(await statusOf(svc.verifyPin('acc-1', '0000', 'p1'))).toBe(403);
    expect(row.pinLockedUntil).toBeInstanceOf(Date);
    // correct PIN is now refused with 429 while locked
    expect(await statusOf(svc.verifyPin('acc-1', '1234', 'p1'))).toBe(429);
  });

  it('clears the lock counter on a successful verify', async () => {
    const { svc, row } = setup({ pinAttempts: 3 });
    await svc.verifyPin('acc-1', '1234', 'p1');
    expect(row.pinAttempts).toBe(0);
    expect(row.pinLockedUntil).toBeNull();
  });

  it('409s when no PIN is set', async () => {
    const { svc } = setup({ parentPinHash: null });
    expect(await statusOf(svc.verifyPin('acc-1', '1234', 'p1'))).toBe(409);
  });

  it('first-time setPin (no PIN yet) succeeds without a current PIN and clears any lockout', async () => {
    const { svc, row } = setup({ parentPinHash: null, pinAttempts: 5, pinLockedUntil: new Date(Date.now() + 1000) });
    await svc.setPin('acc-1', '9999');
    expect(row.pinAttempts).toBe(0);
    expect(row.pinLockedUntil).toBeNull();
    expect(row.parentPinHash).toBe('9999');
  });

  it('changing an existing PIN requires the current one — succeeds when it matches', async () => {
    const { svc, row } = setup(); // existing PIN '1234'
    await svc.setPin('acc-1', '9999', '1234');
    expect(row.parentPinHash).toBe('9999');
  });

  it('changing an existing PIN without the current one is refused (403) and does not overwrite', async () => {
    const { svc, row } = setup(); // existing PIN '1234'
    expect(await statusOf(svc.setPin('acc-1', '9999'))).toBe(403);
    expect(row.parentPinHash).toBe('1234');
  });

  it('changing an existing PIN with a wrong current PIN counts toward the durable lockout', async () => {
    const { svc, row } = setup({ pinAttempts: 4 }); // existing PIN '1234'
    expect(await statusOf(svc.setPin('acc-1', '9999', '0000'))).toBe(403);
    expect(row.pinLockedUntil).toBeInstanceOf(Date); // 5th failure trips the lock
    expect(row.parentPinHash).toBe('1234');
    // correct current PIN is now refused with 429 while locked
    expect(await statusOf(svc.setPin('acc-1', '9999', '1234'))).toBe(429);
  });

  it('resetChat fully wipes the chat — messages, homework rows AND image blobs (ownership-checked)', async () => {
    const { svc, prisma, storage } = setup();
    const p = prisma as unknown as {
      chatMessage: { deleteMany: ReturnType<typeof vi.fn> };
      homeworkUpload: { deleteMany: ReturnType<typeof vi.fn> };
      profile: { findFirst: ReturnType<typeof vi.fn> };
    };
    const s = storage as unknown as { deleteProfileHomework: ReturnType<typeof vi.fn> };
    await expect(svc.resetChat('acc-1', 'p1')).resolves.toEqual({ ok: true });
    expect(p.profile.findFirst).toHaveBeenCalled(); // assertProfileOwned ran
    expect(s.deleteProfileHomework).toHaveBeenCalledWith('acc-1', 'p1'); // image blobs erased
    expect(p.chatMessage.deleteMany).toHaveBeenCalledWith({ where: { profileId: 'p1' } });
    expect(p.homeworkUpload.deleteMany).toHaveBeenCalledWith({ where: { profileId: 'p1' } });
  });
});
