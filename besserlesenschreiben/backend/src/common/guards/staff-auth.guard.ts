import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ApiException } from '../exceptions/api-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { STAFF_COOKIE } from '../staff-cookie';
import { IS_STAFF_PUBLIC_KEY } from '../decorators/staff-public.decorator';
import type { Env } from '../../config/env';

interface StaffTokenPayload {
  sub: string;
  role?: 'reviewer' | 'admin';
}

/**
 * Guards the staff realm (ARCHITECTURE §1a). Applied at the staff controller CLASS level so every route is
 * default-deny; the staff auth endpoints opt out with `@StaffPublic()`. (The controller is also `@Public()`
 * so the GLOBAL family `JwtAuthGuard` is skipped first.) Verifies the staff JWT with `STAFF_JWT_SECRET` and
 * `aud:'staff'` — a family token never validates here. The reviewer id is read ONLY from the token `sub`.
 * A revoked reviewer's token stops working: we re-check `status` each call.
 */
@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isStaffPublic = this.reflector.getAllAndOverride<boolean>(IS_STAFF_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isStaffPublic) return true;

    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      cookies?: Record<string, string | undefined>;
      reviewer?: { id: string; role: 'reviewer' | 'admin' };
    }>();

    const auth = req.headers['authorization'];
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    const token = bearer ?? req.cookies?.[STAFF_COOKIE];
    if (!token) throw new ApiException(401, 'UNAUTHENTICATED', 'Anmeldung erforderlich.');

    let payload: StaffTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<StaffTokenPayload>(token, {
        secret: this.config.get('STAFF_JWT_SECRET', { infer: true }),
        audience: 'staff',
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'TokenExpiredError') {
        throw new ApiException(401, 'SESSION_EXPIRED', 'Sitzung abgelaufen.');
      }
      throw new ApiException(401, 'UNAUTHENTICATED', 'Ungültiges Token.');
    }

    // A token alone isn't enough — the reviewer must still be active (admin can revoke).
    const reviewer = await this.prisma.reviewer.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, status: true },
    });
    if (!reviewer || reviewer.status !== 'active') {
      throw new ApiException(401, 'UNAUTHENTICATED', 'Kein gültiger Zugang.');
    }

    req.reviewer = { id: reviewer.id, role: reviewer.role === 'admin' ? 'admin' : 'reviewer' };
    return true;
  }
}
