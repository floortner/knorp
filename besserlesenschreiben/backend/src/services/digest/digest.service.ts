import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { assertProfileOwned } from '../../common/ownership';
import { daysAgo } from '../../common/dates';
import { StorageService } from '../storage/storage.service';
import { buildDigestData, renderDigest, type DueRow } from './digest.render';

const WINDOW_DAYS = 14;
const DUE_EXAMPLE_ITEMS = 3;

/**
 * Digest generation (SPEC §6/§8). Regenerates the compact `digest.md` from the attempt table on
 * demand (last ~14 days) + FSRS due skills, writes it through to per-user storage, and returns the
 * markdown. This is the LLM-facing view reused by chat and LLM-session generation.
 */
@Injectable()
export class DigestService {
  private readonly logger = new Logger('DigestService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async generate(accountId: string, profileId: string): Promise<{ markdown: string }> {
    const profile = await assertProfileOwned(this.prisma, accountId, profileId);
    const now = new Date();

    const attempts = await this.prisma.attempt.findMany({
      where: { profileId, createdAt: { gte: daysAgo(now, WINDOW_DAYS) } },
      select: { skillTags: true, isCorrect: true, timeMs: true, prompt: true, expected: true, given: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const dueStates = await this.prisma.reviewState.findMany({
      where: { profileId, due: { lte: now } },
      select: { skillTag: true },
      orderBy: { due: 'asc' },
    });
    const due: DueRow[] = await Promise.all(
      dueStates.map(async (s) => ({ skill: s.skillTag, examples: await this.examplesFor(s.skillTag) })),
    );

    const data = buildDigestData(
      {
        name: profile.name,
        buddy: profile.buddy,
        goalPerWeek: profile.goalPerWeek,
        soundOn: profile.soundOn,
        dyslexicFont: profile.dyslexicFont,
        fontScale: Number(profile.fontScale),
      },
      attempts,
      due,
      now,
      WINDOW_DAYS,
    );

    const markdown = renderDigest(data);
    // Best-effort cache: the digest is fully regenerable from the DB, so a storage hiccup must not
    // fail the request. Storage itself now throws on failure (no silent no-op); we absorb it here.
    try {
      await this.storage.writeUserFile(accountId, profileId, 'digest.md', markdown);
    } catch (err) {
      this.logger.warn({ event: 'digest.cache_write_failed', err: (err as Error).message }, 'digest cache write failed');
    }
    return { markdown };
  }

  /** A few example words from the item bank that drill a skill, for the "Fällig" section. */
  private async examplesFor(skillTag: string): Promise<string[]> {
    const items = await this.prisma.itemBank.findMany({
      where: { skillTags: { has: skillTag } },
      select: { payload: true },
      take: DUE_EXAMPLE_ITEMS,
      orderBy: { difficulty: 'asc' },
    });
    return items
      .map((i) => (i.payload as { word?: unknown } | null)?.word)
      .filter((w): w is string => typeof w === 'string');
  }
}
