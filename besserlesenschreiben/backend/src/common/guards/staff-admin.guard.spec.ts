import { describe, it, expect } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { StaffAdminGuard } from './staff-admin.guard';
import { ApiException } from '../exceptions/api-exception';

function ctxFor(reviewer?: { role?: string }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ reviewer }) }),
  } as unknown as ExecutionContext;
}

describe('StaffAdminGuard', () => {
  const guard = new StaffAdminGuard();

  it('allows an admin through', () => {
    expect(guard.canActivate(ctxFor({ role: 'admin' }))).toBe(true);
  });

  it('rejects a plain reviewer with 403', () => {
    const err = (() => {
      try {
        guard.canActivate(ctxFor({ role: 'reviewer' }));
      } catch (e) {
        return e as ApiException;
      }
    })();
    expect(err).toBeInstanceOf(ApiException);
    expect(err!.getStatus()).toBe(403);
  });

  it('rejects when no reviewer is set (defence-in-depth)', () => {
    expect(() => guard.canActivate(ctxFor(undefined))).toThrow(ApiException);
  });
});
