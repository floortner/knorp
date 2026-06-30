import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { TokenPayload } from '../guards/jwt-auth.guard';

/**
 * The child a parent-scoped action targets, read ONLY from the signed parentToken (never the request
 * body — security §1). Guaranteed present by ParentScopeGuard, which rejects a token without it.
 */
export const ParentProfileId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<{ tokenPayload?: TokenPayload }>();
  return req.tokenPayload?.profileId as string;
});
