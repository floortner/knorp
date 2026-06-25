import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ApiException } from '../exceptions/api-exception';
import type { TokenPayload } from './jwt-auth.guard';

/**
 * Gates parent-scoped routes (‡): the Bearer must be a `parentToken` (JWT with scope='parent',
 * obtained via POST /parent/verify-pin). Runs after the global JwtAuthGuard, which populates
 * req.tokenPayload. Used by destructive/sensitive routes (reset, unlock-next, billing).
 */
@Injectable()
export class ParentScopeGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ tokenPayload?: TokenPayload }>();
    if (req.tokenPayload?.scope === 'parent') return true;
    throw new ApiException(403, 'PARENT_SCOPE_REQUIRED', 'Eltern-PIN erforderlich.');
  }
}
