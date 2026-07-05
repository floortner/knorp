import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

export interface LexemePick {
  lemma: string;
  syllabification: string;
  genus: string | null;
  hk: number;
}

/**
 * The lexeme foundation selector (Rechtschreibwortschatz 2015). Turns a target skill into a pool of
 * real, level-appropriate words that actually carry that orthographic feature — grounding LLM lecture
 * generation in genuine German words instead of hallucinated ones. Also the seam for (later)
 * deterministic bank generation straight from the annotations.
 */
@Injectable()
export class LexemeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Random sample of words for a skill within a frequency ceiling (lower HK = more frequent/common).
   * Uses the GIN-indexed array-containment on `skill_tags`; only the un-mapped columns are selected so
   * the raw rows need no camelCase bridging.
   */
  async pickForSkill(skillTag: string, opts: { maxHk?: number; limit?: number } = {}): Promise<LexemePick[]> {
    const maxHk = opts.maxHk ?? 12;
    const limit = opts.limit ?? 12;
    return this.prisma.$queryRaw<LexemePick[]>(Prisma.sql`
      SELECT lemma, syllabification, genus, hk
      FROM lexeme
      WHERE skill_tags @> ARRAY[${skillTag}]::text[] AND hk <= ${maxHk}
      ORDER BY random()
      LIMIT ${limit}`);
  }

  /**
   * A compact, prompt-ready word pool for up to the first few target skills. One line per skill; each
   * word carries its ARTICLE (nouns) and SYLLABIFICATION so the model can build raster/sylarrange/compound
   * items from real data instead of guessing splits — e.g. `Wasser (das; was-ser)`, `fahren (fah-ren)`.
   * Skills with no matching word are omitted. Empty string when nothing matches (caller drops the section).
   */
  async wordPoolFor(skillTags: string[], opts: { maxHk?: number; perSkill?: number } = {}): Promise<string> {
    const perSkill = opts.perSkill ?? 8;
    const tags = skillTags.slice(0, 4);
    // The per-skill picks are independent — run them in parallel; this is on the lecture-generation path.
    const pools = await Promise.all(
      tags.map((t) => this.pickForSkill(t, { maxHk: opts.maxHk, limit: perSkill })),
    );
    const entry = (w: LexemePick) => `${w.lemma} (${w.genus ? `${w.genus}; ` : ''}${w.syllabification})`;
    return tags
      .map((t, i) => (pools[i].length ? `- ${t}: ${pools[i].map(entry).join(', ')}` : null))
      .filter((line): line is string => line !== null)
      .join('\n');
  }
}
