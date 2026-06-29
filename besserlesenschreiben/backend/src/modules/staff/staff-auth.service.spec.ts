import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import { StaffAuthService } from './staff-auth.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { EmailService } from '../../services/email/email.service';
import type { Env } from '../../config/env';
import { ApiException } from '../../common/exceptions/api-exception';

vi.mock('argon2', () => ({
  hash: vi.fn(async (code: string) => code),
  verify: vi.fn(async (hash: string, code: string) => hash === code),
}));

function setup(opts: {
  reviewer?: { id: string; email: string; name: string; role: string; status: string } | null;
  code?: { id: string; codeHash: string; expiresAt: Date; attempts: number } | null;
} = {}) {
  const email = { sendLoginCode: vi.fn(async () => undefined) } as unknown as EmailService;
  const prisma = {
    reviewer: { findUnique: vi.fn(async () => opts.reviewer ?? null) },
    staffLoginCode: {
      create: vi.fn(async () => ({ id: 'code-1' })),
      findFirst: vi.fn(async () => opts.code ?? null),
      update: vi.fn(async () => ({})),
    },
  } as unknown as PrismaService;
  const jwt = { signAsync: vi.fn(async () => 'staff-token') } as unknown as JwtService;
  const config = { get: () => 'staff-secret' } as unknown as ConfigService<Env, true>;
  return { svc: new StaffAuthService(prisma, jwt, email, config), prisma, email };
}

async function statusOf(p: Promise<unknown>): Promise<number | 'ok'> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return (e as ApiException).getStatus();
  }
}

describe('StaffAuthService.requestCode (no self-signup, no enumeration)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('issues no code for an unknown email but still returns ok', async () => {
    const { svc, prisma, email } = setup({ reviewer: null });
    await expect(svc.requestCode('stranger@x.test')).resolves.toEqual({ ok: true });
    expect(prisma.staffLoginCode.create).not.toHaveBeenCalled();
    expect(email.sendLoginCode).not.toHaveBeenCalled();
  });

  it('issues + emails a code for an active reviewer', async () => {
    const { svc, prisma, email } = setup({
      reviewer: { id: 'rev-1', email: 'dana@team.test', name: 'Dana', role: 'reviewer', status: 'active' },
    });
    await expect(svc.requestCode('dana@team.test')).resolves.toEqual({ ok: true });
    expect(prisma.staffLoginCode.create).toHaveBeenCalledOnce();
    expect(email.sendLoginCode).toHaveBeenCalledOnce();
  });
});

describe('StaffAuthService.verify', () => {
  beforeEach(() => vi.clearAllMocks());

  const validCode = { id: 'code-1', codeHash: '123456', expiresAt: new Date(Date.now() + 60_000), attempts: 0 };

  it('issues a staff token + me for a valid code owned by an active reviewer', async () => {
    const { svc } = setup({
      code: validCode,
      reviewer: { id: 'rev-1', email: 'dana@team.test', name: 'Dana', role: 'admin', status: 'active' },
    });
    await expect(svc.verify('dana@team.test', '123456')).resolves.toEqual({
      token: 'staff-token',
      me: { reviewerId: 'rev-1', name: 'Dana', role: 'admin' },
    });
  });

  it('401s a valid code whose reviewer was revoked', async () => {
    const { svc } = setup({
      code: validCode,
      reviewer: { id: 'rev-1', email: 'dana@team.test', name: 'Dana', role: 'reviewer', status: 'revoked' },
    });
    expect(await statusOf(svc.verify('dana@team.test', '123456'))).toBe(401);
  });

  it('401s a wrong code', async () => {
    const { svc } = setup({
      code: validCode,
      reviewer: { id: 'rev-1', email: 'dana@team.test', name: 'Dana', role: 'reviewer', status: 'active' },
    });
    expect(await statusOf(svc.verify('dana@team.test', '999999'))).toBe(401);
  });
});
