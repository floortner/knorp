import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JwtService } from '@nestjs/jwt';
import { ParentService } from './parent.service';
import { PrismaService } from '../../prisma/prisma.service';
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
  } as unknown as PrismaService;
  const jwt = { signAsync: vi.fn(async () => 'parent-token') } as unknown as JwtService;
  return { svc: new ParentService(prisma, jwt), row };
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
    await expect(svc.verifyPin('acc-1', '1234')).resolves.toEqual({ parentToken: 'parent-token' });
  });

  it('locks out (429) after 5 wrong attempts and blocks the correct PIN during the window', async () => {
    const { svc, row } = setup();
    for (let i = 0; i < 4; i++) {
      expect(await statusOf(svc.verifyPin('acc-1', '0000'))).toBe(403);
    }
    expect(row.pinAttempts).toBe(4);
    // 5th wrong attempt trips the lock
    expect(await statusOf(svc.verifyPin('acc-1', '0000'))).toBe(403);
    expect(row.pinLockedUntil).toBeInstanceOf(Date);
    // correct PIN is now refused with 429 while locked
    expect(await statusOf(svc.verifyPin('acc-1', '1234'))).toBe(429);
  });

  it('clears the lock counter on a successful verify', async () => {
    const { svc, row } = setup({ pinAttempts: 3 });
    await svc.verifyPin('acc-1', '1234');
    expect(row.pinAttempts).toBe(0);
    expect(row.pinLockedUntil).toBeNull();
  });

  it('409s when no PIN is set', async () => {
    const { svc } = setup({ parentPinHash: null });
    expect(await statusOf(svc.verifyPin('acc-1', '1234'))).toBe(409);
  });

  it('setPin clears any standing lockout', async () => {
    const { svc, row } = setup({ pinAttempts: 5, pinLockedUntil: new Date(Date.now() + 1000) });
    await svc.setPin('acc-1', '9999');
    expect(row.pinAttempts).toBe(0);
    expect(row.pinLockedUntil).toBeNull();
    expect(row.parentPinHash).toBe('9999');
  });
});
