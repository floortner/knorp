import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../common/exceptions/api-exception';
import { assertProfileOwned } from '../../common/ownership';
import { StorageService } from '../../services/storage/storage.service';
import { isJokerAvailable } from '../progress/gamification';
import type { ProfileModel } from '../../generated/prisma/models';
import type { CreateProfileInput, UpdateSettingsInput } from './profiles.dto';

/** Wire-shape view of a profile (Decimal → number; camelCase already). */
function view(p: ProfileModel) {
  const now = new Date();
  return {
    id: p.id,
    name: p.name,
    buddy: p.buddy,
    goalPerWeek: p.goalPerWeek,
    soundOn: p.soundOn,
    dyslexicFont: p.dyslexicFont,
    fontScale: Number(p.fontScale),
    stars: p.stars,
    streakDays: p.streakDays,
    jokerAvailable: isJokerAvailable(p.jokerUsedWeek, now),
    unlockedUnit: p.unlockedUnit,
    createdAt: p.createdAt,
  };
}

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger('ProfilesService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getMe(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { profiles: { orderBy: { createdAt: 'asc' } } },
    });
    if (!account) throw new ApiException(404, 'NOT_FOUND', 'Konto nicht gefunden.');
    return {
      account: { id: account.id, email: account.email },
      profiles: account.profiles.map(view),
    };
  }

  async create(accountId: string, dto: CreateProfileInput) {
    const profile = await this.prisma.profile.create({
      data: {
        accountId,
        name: dto.name,
        buddy: dto.buddy ?? 'nepo',
        goalPerWeek: dto.goal ?? 5,
      },
    });
    return { profile: view(profile) };
  }

  async get(accountId: string, id: string) {
    const p = await assertProfileOwned(this.prisma, accountId, id);
    return {
      profile: view(p),
      settings: {
        soundOn: p.soundOn,
        dyslexicFont: p.dyslexicFont,
        fontScale: Number(p.fontScale),
        goalPerWeek: p.goalPerWeek,
        buddy: p.buddy,
      },
      stars: p.stars,
      streak: p.streakDays,
    };
  }

  async updateSettings(accountId: string, id: string, dto: UpdateSettingsInput) {
    await assertProfileOwned(this.prisma, accountId, id);
    const { goal, ...rest } = dto;
    const updated = await this.prisma.profile.update({
      where: { id },
      data: { ...rest, ...(goal !== undefined ? { goalPerWeek: goal } : {}) },
    });
    return { profile: view(updated) };
  }

  /**
   * Reset a student's learning progress (destructive): wipes attempts, FSRS schedules and sessions, and
   * returns gamification + unlock state to the start. Profile identity/settings are kept. Guarded in the
   * UI by a two-step confirmation (frontend SPEC §8) — there is no PIN gate.
   */
  async reset(accountId: string, id: string): Promise<{ ok: true }> {
    await assertProfileOwned(this.prisma, accountId, id);
    await this.prisma.$transaction([
      this.prisma.attempt.deleteMany({ where: { profileId: id } }),
      this.prisma.reviewState.deleteMany({ where: { profileId: id } }),
      this.prisma.session.deleteMany({ where: { profileId: id } }),
      this.prisma.profile.update({
        where: { id },
        data: { stars: 0, streakDays: 0, lastActive: null, unlockedUnit: 1 },
      }),
    ]);
    this.logger.log({ event: 'profile.reset', profileId: id }, 'profile progress reset');
    return { ok: true };
  }

  /**
   * Fully delete a student's trainer chat (destructive): the messages + trainer lectures (chat_message
   * rows) AND every uploaded homework photo — the stored image blobs plus the homework_upload rows and
   * their review audit (cascade). Learning progress (attempts, plan, stars) is a separate concern — see
   * reset() — and is NOT touched here.
   *
   * Storage is erased BEFORE the DB rows (mirrors account deletion) so a storage failure leaves the rows
   * for a retry rather than orphaning image blobs behind already-deleted records.
   */
  async resetChat(accountId: string, id: string): Promise<{ ok: true }> {
    await assertProfileOwned(this.prisma, accountId, id);
    await this.storage.deleteProfileHomework(accountId, id);
    const [messages, uploads] = await this.prisma.$transaction([
      this.prisma.chatMessage.deleteMany({ where: { profileId: id } }),
      this.prisma.homeworkUpload.deleteMany({ where: { profileId: id } }),
    ]);
    this.logger.log(
      { event: 'profile.reset_chat', profileId: id, messages: messages.count, uploads: uploads.count },
      'chat fully cleared',
    );
    return { ok: true };
  }
}
