import { describe, it, expect, vi } from 'vitest';
import { LexemeService } from './lexeme.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { LexemePick } from './lexeme.service';

/** Build a service whose $queryRaw resolves per-skill rows, keyed off the Sql's first bound value. */
function makeService(pools: Record<string, LexemePick[]>) {
  const $queryRaw = vi.fn((sql: { values?: unknown[] }) => {
    const tag = String(sql.values?.[0] ?? '');
    return Promise.resolve(pools[tag] ?? []);
  });
  const prisma = { $queryRaw } as unknown as PrismaService;
  return { svc: new LexemeService(prisma), $queryRaw };
}

const pick = (lemma: string): LexemePick => ({ lemma, syllabification: lemma, genus: null, hk: 8 });

describe('LexemeService.wordPoolFor', () => {
  it('formats one line per skill that has words, and drops skills with none', async () => {
    const { svc } = makeService({
      vowel_length: [pick('Jahr'), pick('viel')],
      dehnung_h: [], // no matching words → line omitted
      double_consonant: [pick('Wasser')],
    });

    const pool = await svc.wordPoolFor(['vowel_length', 'dehnung_h', 'double_consonant', 'article']);

    expect(pool).toBe('- vowel_length: Jahr, viel\n- double_consonant: Wasser');
    expect(pool).not.toContain('dehnung_h'); // empty skill dropped
    expect(pool).not.toContain('article'); // no pool for it either
  });

  it('caps at the first four target skills', async () => {
    const pools = Object.fromEntries(
      ['a', 'b', 'c', 'd', 'e'].map((t) => [t, [pick(t.toUpperCase())]]),
    );
    const { svc, $queryRaw } = makeService(pools);

    await svc.wordPoolFor(['a', 'b', 'c', 'd', 'e']);

    expect($queryRaw).toHaveBeenCalledTimes(4); // e is never queried
  });

  it('returns an empty string when nothing matches (caller drops the section)', async () => {
    const { svc } = makeService({});
    expect(await svc.wordPoolFor(['vowel_length'])).toBe('');
  });
});
