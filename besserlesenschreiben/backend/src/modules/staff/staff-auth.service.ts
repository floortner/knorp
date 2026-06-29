import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../services/email/email.service';
import { ApiException } from '../../common/exceptions/api-exception';
import { STAFF_SESSION_TTL } from '../../common/staff-cookie';
import type { Env } from '../../config/env';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_VERIFY_ATTEMPTS = 5;

export interface StaffMe {
  reviewerId: string;
  name: string;
  role: 'reviewer' | 'admin';
}

/**
 * Staff realm auth (ARCHITECTURE §1a). Passwordless email-code like the family flow, but: codes live in
 * a separate `staff_login_code` table, the JWT is signed with `STAFF_JWT_SECRET` and `aud:'staff'`, and
 * there is NO self-signup — a code is only issued when an active reviewer owns the email (admin-provisioned).
 */
@Injectable()
export class StaffAuthService {
  private readonly logger = new Logger('StaffAuthService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Always returns {ok:true} (no staff-enumeration). A code is sent only to an active reviewer. */
  async requestCode(email: string): Promise<{ ok: true }> {
    const reviewer = await this.prisma.reviewer.findUnique({ where: { email } });
    if (reviewer && reviewer.status === 'active') {
      const code = String(randomInt(100000, 1000000)); // 6-digit
      await this.prisma.staffLoginCode.create({
        data: { email, codeHash: await argon2.hash(code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
      });
      await this.email.sendLoginCode(email, code);
      this.logger.log({ event: 'staff.code_requested', reviewerId: reviewer.id }, 'staff code issued');
    }
    return { ok: true };
  }

  async verify(email: string, code: string): Promise<{ token: string; me: StaffMe }> {
    const login = await this.prisma.staffLoginCode.findFirst({
      where: { email, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    const invalid = new ApiException(401, 'UNAUTHENTICATED', 'Code ungültig oder abgelaufen.');
    if (!login || login.expiresAt < new Date()) throw invalid;
    if (login.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new ApiException(429, 'RATE_LIMITED', 'Zu viele Versuche. Fordere einen neuen Code an.');
    }

    if (!(await argon2.verify(login.codeHash, code))) {
      await this.prisma.staffLoginCode.update({
        where: { id: login.id },
        data: { attempts: { increment: 1 } },
      });
      throw invalid;
    }

    // Code is valid — it must still belong to an active reviewer (revocation between issue and verify).
    const reviewer = await this.prisma.reviewer.findUnique({ where: { email } });
    if (!reviewer || reviewer.status !== 'active') throw invalid;

    await this.prisma.staffLoginCode.update({
      where: { id: login.id },
      data: { consumedAt: new Date() },
    });

    const role = reviewer.role === 'admin' ? 'admin' : 'reviewer';
    const token = await this.jwt.signAsync(
      { sub: reviewer.id, role },
      {
        secret: this.config.get('STAFF_JWT_SECRET', { infer: true }),
        audience: 'staff',
        expiresIn: STAFF_SESSION_TTL,
      },
    );
    this.logger.log({ event: 'staff.verified', reviewerId: reviewer.id }, 'staff login ok');
    return { token, me: { reviewerId: reviewer.id, name: reviewer.name, role } };
  }

  async me(reviewerId: string): Promise<StaffMe> {
    const reviewer = await this.prisma.reviewer.findUnique({ where: { id: reviewerId } });
    if (!reviewer || reviewer.status !== 'active') {
      throw new ApiException(401, 'UNAUTHENTICATED', 'Kein gültiger Zugang.');
    }
    return {
      reviewerId: reviewer.id,
      name: reviewer.name,
      role: reviewer.role === 'admin' ? 'admin' : 'reviewer',
    };
  }
}
