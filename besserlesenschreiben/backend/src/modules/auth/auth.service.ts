import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../services/email/email.service';
import { ApiException } from '../../common/exceptions/api-exception';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_VERIFY_ATTEMPTS = 5; // lock the code after this many wrong tries
const SESSION_TTL = '30d';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
  ) {}

  /** Always returns {ok:true} — never reveal whether an email exists (ARCHITECTURE §5). */
  async requestCode(email: string): Promise<{ ok: true }> {
    const code = String(randomInt(1000, 10000)); // 4-digit
    const codeHash = await argon2.hash(code);
    const account = await this.prisma.account.findUnique({ where: { email } });

    await this.prisma.loginCode.create({
      data: {
        email,
        accountId: account?.id ?? null,
        codeHash,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    await this.email.sendLoginCode(email, code);
    this.logger.log({ event: 'auth.code_requested' }, 'login code issued');
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

    await this.prisma.loginCode.update({
      where: { id: login.id },
      data: { consumedAt: new Date() },
    });

    const existing = await this.prisma.account.findUnique({ where: { email } });
    const isNewAccount = !existing;
    const account =
      existing ??
      (await this.prisma.account.create({
        data: { email, entitlement: { create: {} } },
      }));

    const token = await this.jwt.signAsync({ sub: account.id }, { expiresIn: SESSION_TTL });
    this.logger.log({ event: 'auth.verified', accountId: account.id, isNewAccount }, 'login ok');
    return { token, isNewAccount };
  }
}
