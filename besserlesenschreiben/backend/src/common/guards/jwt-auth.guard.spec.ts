import { describe, it, expect, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiException } from '../exceptions/api-exception';

interface ReqShape {
  headers: Record<string, string | undefined>;
  cookies?: Record<string, string | undefined>;
  account?: { id: string };
  tokenPayload?: unknown;
}

function ctxFor(req: ReqShape): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function makeGuard(opts: {
  isPublic?: boolean;
  verify?: (token: string) => Promise<{ sub: string; scope?: 'parent' }>;
}) {
  const reflector = { getAllAndOverride: () => opts.isPublic ?? false } as unknown as Reflector;
  const jwt = {
    verifyAsync: vi.fn(async (token: string) => {
      if (!opts.verify) throw new Error('no verifier');
      return opts.verify(token);
    }),
  } as unknown as JwtService;
  const config = { get: () => 'secret' } as unknown as ConstructorParameters<typeof JwtAuthGuard>[2];
  return new JwtAuthGuard(jwt, reflector, config);
}

describe('JwtAuthGuard', () => {
  it('lets @Public() routes through without a token', async () => {
    const guard = makeGuard({ isPublic: true });
    await expect(guard.canActivate(ctxFor({ headers: {} }))).resolves.toBe(true);
  });

  it('rejects when neither Bearer nor cookie is present', async () => {
    const guard = makeGuard({});
    await expect(guard.canActivate(ctxFor({ headers: {} }))).rejects.toBeInstanceOf(ApiException);
  });

  it('accepts a Bearer token and sets account from sub only', async () => {
    const guard = makeGuard({ verify: async () => ({ sub: 'acc-1' }) });
    const req: ReqShape = { headers: { authorization: 'Bearer abc' } };
    await expect(guard.canActivate(ctxFor(req))).resolves.toBe(true);
    expect(req.account).toEqual({ id: 'acc-1' });
  });

  it('accepts the session cookie when no Bearer is present', async () => {
    const guard = makeGuard({ verify: async () => ({ sub: 'acc-cookie' }) });
    const req: ReqShape = { headers: {}, cookies: { session: 'cookie-jwt' } };
    await expect(guard.canActivate(ctxFor(req))).resolves.toBe(true);
    expect(req.account).toEqual({ id: 'acc-cookie' });
  });

  it('maps an expired token to SESSION_EXPIRED (401)', async () => {
    const guard = makeGuard({
      verify: async () => {
        const e = new Error('expired');
        e.name = 'TokenExpiredError';
        throw e;
      },
    });
    const req: ReqShape = { headers: { authorization: 'Bearer old' } };
    const err = (await guard.canActivate(ctxFor(req)).catch((e: unknown) => e)) as ApiException;
    expect(err).toBeInstanceOf(ApiException);
    expect(err.getStatus()).toBe(401);
    expect(err.getResponse()).toMatchObject({ code: 'SESSION_EXPIRED' });
  });
});
