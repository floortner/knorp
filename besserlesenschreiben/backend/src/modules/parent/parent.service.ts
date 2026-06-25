import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../common/exceptions/api-exception';

const MAX_PIN_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const PARENT_TTL = '15m';

@Injectable()
export class ParentService {
  /**
   * In-memory PIN lockout, keyed by account. Good enough for a single dev instance; a durable
   * store (DB column or Redis) is needed before horizontal scaling — there is intentionally no
   * pin-attempts column in the schema yet (SPEC §4).
   */
  private readonly locks = new Map<string, { fails: number; until: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async setPin(accountId: string, pin: string): Promise<{ ok: true }> {
    const parentPinHash = await argon2.hash(pin);
    await this.prisma.account.update({ where: { id: accountId }, data: { parentPinHash } });
    this.locks.delete(accountId);
    return { ok: true };
  }

  async verifyPin(accountId: string, pin: string): Promise<{ parentToken: string }> {
    const lock = this.locks.get(accountId);
    if (lock && lock.until > Date.now()) {
      throw new ApiException(429, 'RATE_LIMITED', 'Zu viele Fehlversuche. Bitte später erneut.');
    }

    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account?.parentPinHash) {
      throw new ApiException(409, 'CONFLICT', 'Eltern-PIN ist noch nicht gesetzt.');
    }

    const ok = await argon2.verify(account.parentPinHash, pin);
    if (!ok) {
      const fails = (lock?.fails ?? 0) + 1;
      this.locks.set(accountId, {
        fails,
        until: fails >= MAX_PIN_ATTEMPTS ? Date.now() + LOCK_MS : 0,
      });
      throw new ApiException(403, 'FORBIDDEN', 'PIN falsch.');
    }

    this.locks.delete(accountId);
    const parentToken = await this.jwt.signAsync(
      { sub: accountId, scope: 'parent' },
      { expiresIn: PARENT_TTL },
    );
    return { parentToken };
  }
}
