import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../services/email/email.service';
import { StorageService } from '../../services/storage/storage.service';
import { ApiException } from '../../common/exceptions/api-exception';
import type { z } from 'zod';
import type { accountStatusEnum } from '../../contract/staff';

const MAX_LIMIT = 100;
const CODE_TTL_MS = 10 * 60 * 1000; // mirrors AuthService — first login code released on approval

type AccountStatus = z.infer<typeof accountStatusEnum>;

/**
 * Staff USER ADMINISTRATION (ARCHITECTURE §1b, SPEC §6) — the owner's approval/control surface, gated to
 * `role='admin'` by `StaffAdminGuard`. Unlike the pseudonymised review queue, these handle real account
 * identity (the family email + lifecycle). Approve releases the first login code by email; deactivate is
 * reversible; delete is permanent erasure (DB cascade + the account's blob prefix).
 */
@Injectable()
export class UserAdminService {
  private readonly logger = new Logger('UserAdminService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Identity-bearing account list (real email), newest first, optionally filtered by status and/or an
   * email search fragment (case-insensitive contains). Cursor-paged.
   */
  async list(limit: number, status?: AccountStatus, cursor?: string, q?: string) {
    const take = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const where = {
      ...(status ? { status } : {}),
      ...(q ? { email: { contains: q, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          email: true,
          status: true,
          createdAt: true,
          _count: { select: { profiles: true } },
          profiles: { orderBy: { lastActive: 'desc' }, take: 1, select: { lastActive: true } },
        },
      }),
      this.prisma.account.count({ where }),
    ]);

    const page = rows.slice(0, take);
    const items = page.map((a) => ({
      accountId: a.id,
      email: a.email,
      status: a.status as AccountStatus,
      createdAt: a.createdAt.toISOString(),
      profileCount: a._count.profiles,
      lastActive: a.profiles[0]?.lastActive?.toISOString() ?? null,
    }));
    const nextCursor = rows.length > take ? page[page.length - 1].id : null;
    return { items, nextCursor, total };
  }

  /** Approve (pending|deactivated → active) and release the first login code by email. Idempotent. */
  async approve(accountId: string) {
    const account = await this.requireAccount(accountId);
    if (account.status !== 'active') {
      await this.prisma.account.update({ where: { id: accountId }, data: { status: 'active' } });
    }
    // Release the login code now that the account is approved (the signup path emailed nothing).
    const code = String(randomInt(1000, 10000)); // 4-digit, mirrors the family flow
    await this.prisma.loginCode.create({
      data: {
        email: account.email,
        accountId: account.id,
        codeHash: await argon2.hash(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });
    await this.email.sendLoginCode(account.email, code);
    this.logger.log({ event: 'admin.user_approved', accountId }, 'account approved, code released');
    return { accountId, status: 'active' as const };
  }

  /** Block login (reversible). Data is retained; the JwtAuthGuard rejects this account immediately. */
  async deactivate(accountId: string) {
    await this.requireAccount(accountId);
    await this.prisma.account.update({ where: { id: accountId }, data: { status: 'deactivated' } });
    this.logger.log({ event: 'admin.user_deactivated', accountId }, 'account deactivated');
    return { accountId, status: 'deactivated' as const };
  }

  /** Permanent erasure: DB rows (FK cascade from Account) + the account's blob prefix. */
  async remove(accountId: string): Promise<void> {
    await this.requireAccount(accountId);
    // Blobs first: if the DB row is gone we'd lose the prefix; a failed blob wipe must not leave the
    // account "deleted" in the UI while its photos linger. Erase storage, then cascade the DB.
    await this.storage.deleteUserPrefix(accountId);
    await this.prisma.account.delete({ where: { id: accountId } });
    this.logger.log({ event: 'admin.user_deleted', accountId }, 'account erased (db + blobs)');
  }

  private async requireAccount(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, email: true, status: true },
    });
    if (!account) throw new ApiException(404, 'NOT_FOUND', 'Konto nicht gefunden.');
    return account;
  }
}
