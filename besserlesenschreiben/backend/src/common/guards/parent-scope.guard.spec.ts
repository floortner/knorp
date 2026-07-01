import { describe, it, expect } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { ParentScopeGuard } from './parent-scope.guard';
import { ApiException } from '../exceptions/api-exception';

function ctxWith(tokenPayload: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ tokenPayload }) }),
  } as unknown as ExecutionContext;
}

describe('ParentScopeGuard', () => {
  const guard = new ParentScopeGuard();

  it('allows a parent-scoped token that carries a profileId', () => {
    expect(guard.canActivate(ctxWith({ sub: 'a', scope: 'parent', profileId: 'p1' }))).toBe(true);
  });

  it('rejects a parent-scoped token with no bound profileId', () => {
    const err = (() => {
      try {
        guard.canActivate(ctxWith({ sub: 'a', scope: 'parent' }));
      } catch (e) {
        return e as ApiException;
      }
    })();
    expect(err!.getStatus()).toBe(403);
    expect(err!.getResponse()).toMatchObject({ code: 'PARENT_SCOPE_REQUIRED' });
  });

  it('rejects a child (no scope) token with 403 PARENT_SCOPE_REQUIRED', () => {
    const err = (() => {
      try {
        guard.canActivate(ctxWith({ sub: 'a' }));
      } catch (e) {
        return e as ApiException;
      }
    })();
    expect(err).toBeInstanceOf(ApiException);
    expect(err!.getStatus()).toBe(403);
    expect(err!.getResponse()).toMatchObject({ code: 'PARENT_SCOPE_REQUIRED' });
  });

  it('rejects when there is no token payload at all', () => {
    expect(() => guard.canActivate(ctxWith(undefined))).toThrow(ApiException);
  });
});
