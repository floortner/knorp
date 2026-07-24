import { describe, it, expect } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { StaffAdminGuard } from './staff-admin.guard';
import { ApiException } from '../exceptions/api-exception';

function ctxFor(trainer?: { role?: string }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ trainer }) }),
  } as unknown as ExecutionContext;
}

describe('StaffAdminGuard', () => {
  const guard = new StaffAdminGuard();

  it('allows an admin through', () => {
    expect(guard.canActivate(ctxFor({ role: 'admin' }))).toBe(true);
  });

  it('rejects a plain trainer with 403', () => {
    const err = (() => {
      try {
        guard.canActivate(ctxFor({ role: 'trainer' }));
      } catch (e) {
        return e as ApiException;
      }
    })();
    expect(err).toBeInstanceOf(ApiException);
    expect(err!.getStatus()).toBe(403);
  });

  it('rejects when no trainer is set (defence-in-depth)', () => {
    expect(() => guard.canActivate(ctxFor(undefined))).toThrow(ApiException);
  });
});
