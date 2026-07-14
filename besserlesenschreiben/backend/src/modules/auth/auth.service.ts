import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../services/email/email.service';
import { ApiException } from '../../common/exceptions/api-exception';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_VERIFY_ATTEMPTS = 5; // lock the code after this many wrong tries
const RESEND_INTERVAL_MS = 60 * 1000; // min gap between code emails per address (anti email-bomb, P2-3)
const SESSION_TTL = '30d';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
  ) {}

  /**
   * Silent pending-on-first-code signup (ARCHITECTURE §1b/§5). Always returns {ok:true} — never reveal
   * whether an email exists or what state it is in (no enumeration). A code is emailed ONLY for an
   * `active` account; an unknown email silently creates a `pending` account and emails nothing (a staff
   * admin approves before the first code is released); `pending`/`deactivated` accounts get nothing.
   */
  async requestCode(email: string): Promise<{ ok: true }> {
    const account = await this.prisma.account.findUnique({ where: { email } });

    if (!account) {
      // First contact for an unknown email → create the account in `pending`, awaiting staff approval.
      // No code, no email; the family UI shows "we'll review and email you soon".
      await this.prisma.account.create({ data: { email, status: 'pending' } });
      this.logger.log({ event: 'auth.signup_pending' }, 'pending account created (awaiting approval)');
      return { ok: true };
    }

    if (account.status !== 'active') {
      // Known but not yet approved (or deactivated) — emit nothing, but never reveal that.
      this.logger.log({ event: 'auth.code_suppressed', accountId: account.id }, 'code suppressed (not active)');
      return { ok: true };
    }

    // Throttle: at most one code email per address per minute (anti email-bomb / SES cost — security
    // review P2-3). A still-fresh unconsumed code blocks a re-send but stays valid for its 10-min TTL,
    // so legitimate retries still work. Mirrors the staff realm. Uniform {ok:true} either way.
    const recent = await this.prisma.loginCode.findFirst({
      where: { email, consumedAt: null, createdAt: { gt: new Date(Date.now() - RESEND_INTERVAL_MS) } },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      this.logger.log({ event: 'auth.code_throttled', accountId: account.id }, 'code resend throttled');
      return { ok: true };
    }

    // Housekeeping: expired codes are dead rows — sweep them opportunistically on each new issue
    // (no cron needed; the table stays tiny).
    await this.prisma.loginCode.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const code = String(randomInt(1000, 10000)); // 4-digit
    await this.prisma.loginCode.create({
      data: {
        email,
        accountId: account.id,
        codeHash: await argon2.hash(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });
    await this.email.sendLoginCode(email, code);
    this.logger.log({ event: 'auth.code_requested', accountId: account.id }, 'login code issued');
    return { ok: true };
  }

  async verify(
    email: string,
    code: string,
  ): Promise<{ token: string; isNewAccount: boolean }> {
    const login = await this.prisma.loginCode.findFirst({
      where: { email, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    const invalid = new ApiException(401, 'UNAUTHENTICATED', 'Code ungültig oder abgelaufen.');
    if (!login || login.expiresAt < new Date()) throw invalid;
    if (login.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new ApiException(429, 'RATE_LIMITED', 'Zu viele Versuche. Fordere einen neuen Code an.');
    }

    const ok = await argon2.verify(login.codeHash, code);
    if (!ok) {
      await this.prisma.loginCode.update({
        where: { id: login.id },
        data: { attempts: { increment: 1 } },
      });
      throw invalid;
    }

    // The account is provisioned at request-code time and a code is only ever emailed to an `active`
    // account, but re-check here too: a code could have been issued and the account then deactivated.
    const account = await this.prisma.account.findUnique({
      where: { email },
      select: { id: true, status: true, _count: { select: { profiles: true } } },
    });
    if (!account || account.status !== 'active') throw invalid;

    await this.prisma.loginCode.update({
      where: { id: login.id },
      data: { consumedAt: new Date() },
    });

    // No account creation here any more (signup is the pending-on-first-code path). "New" now means a
    // freshly-approved account that hasn't created a child profile yet → the SPA routes to onboarding.
    const isNewAccount = account._count.profiles === 0;
    const token = await this.jwt.signAsync({ sub: account.id }, { expiresIn: SESSION_TTL });
    this.logger.log({ event: 'auth.verified', accountId: account.id, isNewAccount }, 'login ok');
    return { token, isNewAccount };
  }
}
