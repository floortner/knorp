import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ApiException } from '../exceptions/api-exception';
import type { TokenPayload } from './jwt-auth.guard';

/**
 * Gates parent-scoped routes (‡): the Bearer must be a `parentToken` (JWT with scope='parent' AND a
 * signed-in profileId, obtained via POST /parent/verify-pin). Runs after the global JwtAuthGuard, which
 * populates req.tokenPayload. Used by destructive/sensitive routes (reset, unlock-next). The target child
 * comes from the token (never the request body) — read it with @ParentProfileId().
 */
@Injectable()
export class ParentScopeGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ tokenPayload?: TokenPayload }>();
    const payload = req.tokenPayload;
    if (payload?.scope === 'parent' && typeof payload.profileId === 'string') return true;
    throw new ApiException(403, 'PARENT_SCOPE_REQUIRED', 'Eltern-PIN erforderlich.');
  }
}
