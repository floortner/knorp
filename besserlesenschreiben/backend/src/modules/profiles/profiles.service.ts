import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../common/exceptions/api-exception';
import type { ProfileModel } from '../../generated/prisma/models';
import type { CreateProfileInput, UpdateSettingsInput } from './profiles.dto';

/** Wire-shape view of a profile (Decimal → number; camelCase already). */
function view(p: ProfileModel) {
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
    unlockedUnit: p.unlockedUnit,
    createdAt: p.createdAt,
  };
}

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

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

  /** Ownership is derived from the JWT account id — never from the client. Missing/foreign → 404. */
  private async owned(accountId: string, id: string): Promise<ProfileModel> {
    const profile = await this.prisma.profile.findFirst({ where: { id, accountId } });
    if (!profile) throw new ApiException(404, 'NOT_FOUND', 'Profil nicht gefunden.');
    return profile;
  }

  async get(accountId: string, id: string) {
    const p = await this.owned(accountId, id);
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
    await this.owned(accountId, id);
    const { goal, ...rest } = dto;
    const updated = await this.prisma.profile.update({
      where: { id },
      data: { ...rest, ...(goal !== undefined ? { goalPerWeek: goal } : {}) },
    });
    return { profile: view(updated) };
  }
}
