import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../common/exceptions/api-exception';
import { assertProfileOwned } from '../../common/ownership';
import { UNIT_CATALOG } from '../sessions/units.catalog';

const MAX_PIN_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const PARENT_TTL = '15m';

const MAX_UNIT = UNIT_CATALOG.length;

@Injectable()
export class ParentService {
  private readonly logger = new Logger('ParentService');

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

  /** Unlock the next unit for a child (parent scope). Idempotent at the last unit. */
  async unlockNext(accountId: string, profileId: string): Promise<{ ok: true; unlockedUnit: number }> {
    const profile = await assertProfileOwned(this.prisma, accountId, profileId);
    if (profile.unlockedUnit >= MAX_UNIT) {
      return { ok: true, unlockedUnit: profile.unlockedUnit };
    }
    const updated = await this.prisma.profile.update({
      where: { id: profileId },
      data: { unlockedUnit: { increment: 1 } },
    });
    this.logger.log({ event: 'parent.unlock_next', unlockedUnit: updated.unlockedUnit }, 'unit unlocked');
    return { ok: true, unlockedUnit: updated.unlockedUnit };
  }

  /**
   * Reset a child's learning progress (parent scope, destructive): wipes attempts, FSRS schedules and
   * sessions, and returns gamification + unlock state to the start. Profile identity/settings are kept.
   */
  async reset(accountId: string, profileId: string): Promise<{ ok: true }> {
    await assertProfileOwned(this.prisma, accountId, profileId);
    await this.prisma.$transaction([
      this.prisma.attempt.deleteMany({ where: { profileId } }),
      this.prisma.reviewState.deleteMany({ where: { profileId } }),
      this.prisma.session.deleteMany({ where: { profileId } }),
      this.prisma.profile.update({
        where: { id: profileId },
        data: { stars: 0, streakDays: 0, lastActive: null, unlockedUnit: 1 },
      }),
    ]);
    this.logger.log({ event: 'parent.reset', profileId }, 'profile progress reset');
    return { ok: true };
  }
}
