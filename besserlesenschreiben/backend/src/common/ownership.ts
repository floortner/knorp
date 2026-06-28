import { PrismaService } from '../prisma/prisma.service';
import { ApiException } from './exceptions/api-exception';
import type { ProfileModel } from '../generated/prisma/models';

/**
 * Resolve a profile that belongs to the authenticated account, or 404. The account id ALWAYS comes
 * from the JWT (security rule §1); `profileId` is a client-supplied selector (one account has many
 * children) and is only trusted after this ownership check. A foreign or missing id is a 404 — never
 * reveal that the profile exists under another account.
 */
export async function assertProfileOwned(
  prisma: PrismaService,
  accountId: string,
  profileId: string,
): Promise<ProfileModel> {
  const profile = await prisma.profile.findFirst({ where: { id: profileId, accountId } });
  if (!profile) throw new ApiException(404, 'NOT_FOUND', 'Profil nicht gefunden.');
  return profile;
}
