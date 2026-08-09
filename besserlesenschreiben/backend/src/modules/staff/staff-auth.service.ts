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
const RESEND_INTERVAL_MS = 60 * 1000; // min gap between code emails per address (anti email-bomb)

export interface StaffMe {
  trainerId: string;
  name: string;
  role: 'trainer' | 'admin';
  email: string;
  createdAt: string;
}

/** Wire view of the trainer's own identity (contract staffMeSchema). */
function meView(r: { id: string; name: string; role: string; email: string; createdAt: Date }): StaffMe {
  return {
    trainerId: r.id,
    name: r.name,
    role: r.role === 'admin' ? 'admin' : 'trainer',
    email: r.email,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Staff realm auth (ARCHITECTURE §1a). Passwordless email-code like the family flow, but: codes live in
 * a separate `staff_login_code` table, the JWT is signed with `STAFF_JWT_SECRET` and `aud:'staff'`, and
 * there is NO self-signup — a code is only issued when an active trainer owns the email (admin-provisioned).
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

  /** Always returns {ok:true} (no staff-enumeration). A code is sent only to an active trainer. */
  async requestCode(email: string): Promise<{ ok: true }> {
    email = email.trim().toLowerCase(); // normalise so casing/whitespace can't miss a seeded trainer (P3)
    const trainer = await this.prisma.trainer.findUnique({ where: { email } });
    if (trainer && trainer.status === 'active') {
      // Throttle: at most one code email per address per minute. A still-fresh code blocks a re-send
      // (anti email-bomb) — the earlier code stays valid for its 10-min TTL, so legitimate retries work.
      const recent = await this.prisma.staffLoginCode.findFirst({
        where: { email, createdAt: { gt: new Date(Date.now() - RESEND_INTERVAL_MS) } },
        orderBy: { createdAt: 'desc' },
      });
      if (!recent) {
        // Housekeeping: sweep expired codes opportunistically on each new issue (no cron needed).
        await this.prisma.staffLoginCode.deleteMany({ where: { expiresAt: { lt: new Date() } } });
        const code = String(randomInt(100000, 1000000)); // 6-digit
        await this.prisma.staffLoginCode.create({
          data: { email, codeHash: await argon2.hash(code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
        });
        await this.email.sendLoginCode(email, code);
        this.logger.log({ event: 'staff.code_requested', trainerId: trainer.id }, 'staff code issued');
      }
    }
    return { ok: true };
  }

  async verify(email: string, code: string): Promise<{ token: string; me: StaffMe }> {
    email = email.trim().toLowerCase(); // must match the normalisation in requestCode (P3)
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

    // Code is valid — it must still belong to an active trainer (revocation between issue and verify).
    const trainer = await this.prisma.trainer.findUnique({ where: { email } });
    if (!trainer || trainer.status !== 'active') throw invalid;

    await this.prisma.staffLoginCode.update({
      where: { id: login.id },
      data: { consumedAt: new Date() },
    });

    const role = trainer.role === 'admin' ? 'admin' : 'trainer';
    const token = await this.jwt.signAsync(
      { sub: trainer.id, role },
      {
        secret: this.config.get('STAFF_JWT_SECRET', { infer: true }),
        audience: 'staff',
        expiresIn: STAFF_SESSION_TTL,
      },
    );
    this.logger.log({ event: 'staff.verified', trainerId: trainer.id }, 'staff login ok');
    return { token, me: meView(trainer) };
  }

  async me(trainerId: string): Promise<StaffMe> {
    const trainer = await this.prisma.trainer.findUnique({ where: { id: trainerId } });
    if (!trainer || trainer.status !== 'active') {
      throw new ApiException(401, 'UNAUTHENTICATED', 'Kein gültiger Zugang.');
    }
    return meView(trainer);
  }

  /** Update the caller's OWN display name (profile page). Id from the staff JWT, never the request. */
  async updateMe(trainerId: string, name: string): Promise<StaffMe> {
    const trainer = await this.prisma.trainer.update({ where: { id: trainerId }, data: { name } });
    this.logger.log({ event: 'staff.me_updated', trainerId }, 'trainer renamed'); // id + outcome only
    return meView(trainer);
  }
}
