import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { JwtService } from '@nestjs/jwt';
import type { EmailService } from '../../services/email/email.service';
import { ApiException } from '../../common/exceptions/api-exception';

function setup(account: { id: string; status: string; profileCount?: number } | null) {
  const prisma = {
    account: {
      findUnique: vi.fn(async () =>
        account
          ? { id: account.id, email: 'p@x.de', status: account.status, _count: { profiles: account.profileCount ?? 0 } }
          : null,
      ),
      create: vi.fn(async ({ data }: { data: { email: string } }) => ({ id: 'new-acc', email: data.email })),
    },
    loginCode: {
      create: vi.fn(async () => ({ id: 'lc-1' })),
      findFirst: vi.fn(),
      update: vi.fn(async () => ({})),
    },
  } as unknown as PrismaService;
  const jwt = { signAsync: vi.fn(async () => 'jwt-token') } as unknown as JwtService;
  const email = { sendLoginCode: vi.fn(async () => undefined) } as unknown as EmailService;
  return { svc: new AuthService(prisma, jwt, email), prisma, jwt, email };
}

describe('AuthService.requestCode (silent pending-on-first-code)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('unknown email → creates a pending account and emails NOTHING', async () => {
    const { svc, prisma, email } = setup(null);
    await expect(svc.requestCode('new@x.de')).resolves.toEqual({ ok: true });
    expect((prisma.account.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data).toMatchObject({
      email: 'new@x.de',
      status: 'pending',
    });
    expect(email.sendLoginCode).not.toHaveBeenCalled();
    expect(prisma.loginCode.create).not.toHaveBeenCalled();
  });

  it('pending account → no code, no email, still ok (no enumeration)', async () => {
    const { svc, prisma, email } = setup({ id: 'a1', status: 'pending' });
    await expect(svc.requestCode('p@x.de')).resolves.toEqual({ ok: true });
    expect(prisma.account.create).not.toHaveBeenCalled();
    expect(email.sendLoginCode).not.toHaveBeenCalled();
    expect(prisma.loginCode.create).not.toHaveBeenCalled();
  });

  it('deactivated account → no code, no email, still ok', async () => {
    const { svc, email, prisma } = setup({ id: 'a1', status: 'deactivated' });
    await expect(svc.requestCode('p@x.de')).resolves.toEqual({ ok: true });
    expect(email.sendLoginCode).not.toHaveBeenCalled();
    expect(prisma.loginCode.create).not.toHaveBeenCalled();
  });

  it('active account → issues and emails a code', async () => {
    const { svc, prisma, email } = setup({ id: 'a1', status: 'active' });
    await expect(svc.requestCode('p@x.de')).resolves.toEqual({ ok: true });
    expect(prisma.loginCode.create).toHaveBeenCalledOnce();
    expect(email.sendLoginCode).toHaveBeenCalledOnce();
  });
});

describe('AuthService.verify (requires active, no upsert)', () => {
  beforeEach(() => vi.clearAllMocks());

  async function verifyWith(opts: {
    accountStatus: string | null;
    profileCount?: number;
    codeOk?: boolean;
  }) {
    const codeHash = await argon2.hash('1234');
    const prisma = {
      account: {
        findUnique: vi.fn(async () =>
          opts.accountStatus === null
            ? null
            : { id: 'a1', status: opts.accountStatus, _count: { profiles: opts.profileCount ?? 0 } },
        ),
        create: vi.fn(),
      },
      loginCode: {
        findFirst: vi.fn(async () => ({
          id: 'lc-1',
          codeHash,
          attempts: 0,
          expiresAt: new Date(Date.now() + 60_000),
        })),
        update: vi.fn(async () => ({})),
        create: vi.fn(),
      },
    } as unknown as PrismaService;
    const jwt = { signAsync: vi.fn(async () => 'jwt-token') } as unknown as JwtService;
    const email = { sendLoginCode: vi.fn() } as unknown as EmailService;
    const svc = new AuthService(prisma, jwt, email);
    return { res: svc.verify('p@x.de', opts.codeOk === false ? '0000' : '1234'), prisma };
  }

  it('rejects a valid code when the account is not active (deactivated between issue and verify)', async () => {
    const { res } = await verifyWith({ accountStatus: 'deactivated' });
    await expect(res).rejects.toBeInstanceOf(ApiException);
  });

  it('never creates an account (signup is the pending path)', async () => {
    const { res, prisma } = await verifyWith({ accountStatus: 'active', profileCount: 1 });
    await expect(res).resolves.toMatchObject({ token: 'jwt-token', isNewAccount: false });
    expect(prisma.account.create).not.toHaveBeenCalled();
  });

  it('isNewAccount=true when an approved account has no profiles yet', async () => {
    const { res } = await verifyWith({ accountStatus: 'active', profileCount: 0 });
    await expect(res).resolves.toMatchObject({ isNewAccount: true });
  });
});
