import { describe, it, expect, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Reflector } from '@nestjs/core';
import { StaffAuthGuard } from './staff-auth.guard';
import { ApiException } from '../exceptions/api-exception';
import type { PrismaService } from '../../prisma/prisma.service';

interface ReqShape {
  headers: Record<string, string | undefined>;
  cookies?: Record<string, string | undefined>;
  reviewer?: { id: string; role: 'reviewer' | 'admin' };
}

function ctxFor(req: ReqShape): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function makeGuard(opts: {
  verify?: (token: string) => Promise<{ sub: string; role?: 'reviewer' | 'admin' }>;
  reviewer?: { id: string; role: string; status: string } | null;
  isStaffPublic?: boolean;
}) {
  const jwt = {
    verifyAsync: vi.fn(async (token: string) => {
      if (!opts.verify) throw new Error('no verifier');
      return opts.verify(token);
    }),
  } as unknown as JwtService;
  const config = { get: () => 'staff-secret' } as unknown as ConstructorParameters<typeof StaffAuthGuard>[1];
  const prisma = {
    reviewer: { findUnique: vi.fn(async () => opts.reviewer ?? null) },
  } as unknown as PrismaService;
  const reflector = { getAllAndOverride: () => opts.isStaffPublic ?? false } as unknown as Reflector;
  return new StaffAuthGuard(jwt, config, prisma, reflector);
}

describe('StaffAuthGuard', () => {
  it('lets a @StaffPublic() route through without a token (the auth endpoints)', async () => {
    const guard = makeGuard({ isStaffPublic: true });
    await expect(guard.canActivate(ctxFor({ headers: {} }))).resolves.toBe(true);
  });

  it('rejects when neither Bearer nor staff cookie is present (default-deny)', async () => {
    const guard = makeGuard({});
    await expect(guard.canActivate(ctxFor({ headers: {} }))).rejects.toBeInstanceOf(ApiException);
  });

  it('rejects an unverifiable token (e.g. a family JWT signed with the other key)', async () => {
    const guard = makeGuard({
      verify: async () => {
        throw new Error('invalid signature');
      },
    });
    const req: ReqShape = { headers: { authorization: 'Bearer family-token' } };
    await expect(guard.canActivate(ctxFor(req))).rejects.toBeInstanceOf(ApiException);
  });

  it('accepts a valid staff token for an active reviewer and sets reviewer from sub only', async () => {
    const guard = makeGuard({
      verify: async () => ({ sub: 'rev-1', role: 'admin' }),
      reviewer: { id: 'rev-1', role: 'admin', status: 'active' },
    });
    const req: ReqShape = { headers: {}, cookies: { staff_session: 'good' } };
    await expect(guard.canActivate(ctxFor(req))).resolves.toBe(true);
    expect(req.reviewer).toEqual({ id: 'rev-1', role: 'admin' });
  });

  it('rejects a token whose reviewer has been revoked', async () => {
    const guard = makeGuard({
      verify: async () => ({ sub: 'rev-1', role: 'reviewer' }),
      reviewer: { id: 'rev-1', role: 'reviewer', status: 'revoked' },
    });
    const req: ReqShape = { headers: { authorization: 'Bearer good' } };
    await expect(guard.canActivate(ctxFor(req))).rejects.toBeInstanceOf(ApiException);
  });
});
