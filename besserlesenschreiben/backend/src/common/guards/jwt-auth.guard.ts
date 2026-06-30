import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ApiException } from '../exceptions/api-exception';
import { SESSION_COOKIE } from '../session-cookie';
import type { Env } from '../../config/env';

export interface TokenPayload {
  sub: string;
  scope?: 'parent';
  aud?: string | string[];
}

/**
 * Global guard. Everything requires a valid Bearer JWT except routes marked @Public().
 * The account id is read ONLY from the token `sub` (security boundary — SPEC §1).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      cookies?: Record<string, string | undefined>;
      account?: { id: string };
      tokenPayload?: TokenPayload;
    }>();
    const auth = req.headers['authorization'];
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    // Browser sends the httpOnly cookie; API clients/tests may send a Bearer token.
    const token = bearer ?? req.cookies?.[SESSION_COOKIE];
    if (!token) {
      throw new ApiException(401, 'UNAUTHENTICATED', 'Authentifizierung erforderlich.');
    }

    try {
      const payload = await this.jwt.verifyAsync<TokenPayload>(token, {
        secret: this.config.get('JWT_SECRET', { infer: true }),
      });
      // Defence-in-depth realm isolation (ARCHITECTURE §1a): a staff token carries aud:'staff'. The
      // secrets already differ (enforced at boot), but reject it here too so a family route never
      // honours a staff credential even under a key misconfiguration.
      const aud = payload.aud;
      if (aud === 'staff' || (Array.isArray(aud) && aud.includes('staff'))) {
        throw new ApiException(401, 'UNAUTHENTICATED', 'Ungültiges Token.');
      }
      req.account = { id: payload.sub };
      req.tokenPayload = payload;
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'TokenExpiredError') {
        throw new ApiException(401, 'SESSION_EXPIRED', 'Sitzung abgelaufen.');
      }
      throw new ApiException(401, 'UNAUTHENTICATED', 'Ungültiges Token.');
    }
  }
}
