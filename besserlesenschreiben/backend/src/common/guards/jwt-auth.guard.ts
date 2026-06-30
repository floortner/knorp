import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ApiException } from '../exceptions/api-exception';
import { PrismaService } from '../../prisma/prisma.service';
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
    private readonly prisma: PrismaService,
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
      // Access is gated by account status, not payment (ARCHITECTURE §1b, security rule 4). A valid
      // token is not enough: re-read the account each request and require `active`, so a staff
      // deactivate/delete takes effect immediately rather than at 30-day token expiry. The id still
      // comes ONLY from the token `sub` (security §1) — the lookup just authorises it.
      const account = await this.prisma.account.findUnique({
        where: { id: payload.sub },
        select: { status: true },
      });
      if (!account || account.status !== 'active') {
        throw new ApiException(403, 'ACCOUNT_INACTIVE', 'Dein Zugang ist nicht aktiv.');
      }
      req.account = { id: payload.sub };
      req.tokenPayload = payload;
      return true;
    } catch (err) {
      // Our own deliberate rejections (realm-isolation, inactive account) pass straight through —
      // only JWT-verification failures get mapped to the generic 401s below.
      if (err instanceof ApiException) throw err;
      if (err instanceof Error && err.name === 'TokenExpiredError') {
        throw new ApiException(401, 'SESSION_EXPIRED', 'Sitzung abgelaufen.');
      }
      throw new ApiException(401, 'UNAUTHENTICATED', 'Ungültiges Token.');
    }
  }
}
