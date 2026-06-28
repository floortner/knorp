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

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async setPin(accountId: string, pin: string): Promise<{ ok: true }> {
    const parentPinHash = await argon2.hash(pin);
    // Setting/replacing the PIN clears any standing lockout.
    await this.prisma.account.update({
      where: { id: accountId },
      data: { parentPinHash, pinAttempts: 0, pinLockedUntil: null },
    });
    return { ok: true };
  }

  /**
   * Verify the parent PIN with a durable lockout (5 fails / 15 min), persisted on `account` so it
   * survives restarts and holds across scaled-out instances (SPEC §4 — no in-memory security state).
   */
  async verifyPin(accountId: string, pin: string): Promise<{ parentToken: string }> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account?.parentPinHash) {
      throw new ApiException(409, 'CONFLICT', 'Eltern-PIN ist noch nicht gesetzt.');
    }

    if (account.pinLockedUntil && account.pinLockedUntil.getTime() > Date.now()) {
      throw new ApiException(429, 'RATE_LIMITED', 'Zu viele Fehlversuche. Bitte später erneut.');
    }

    const ok = await argon2.verify(account.parentPinHash, pin);
    if (!ok) {
      const fails = account.pinAttempts + 1;
      const locked = fails >= MAX_PIN_ATTEMPTS;
      await this.prisma.account.update({
        where: { id: accountId },
        data: {
          // Reset the counter once the lock trips so the next window starts clean after it expires.
          pinAttempts: locked ? 0 : fails,
          pinLockedUntil: locked ? new Date(Date.now() + LOCK_MS) : null,
        },
      });
      throw new ApiException(403, 'FORBIDDEN', 'PIN falsch.');
    }

    if (account.pinAttempts !== 0 || account.pinLockedUntil) {
      await this.prisma.account.update({
        where: { id: accountId },
        data: { pinAttempts: 0, pinLockedUntil: null },
      });
    }
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
