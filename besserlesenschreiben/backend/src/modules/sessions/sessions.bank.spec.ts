import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionsService } from './sessions.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { LlmService } from '../../services/llm/llm.service';
import type { LexemeService } from '../../services/lexeme/lexeme.service';
import type { DigestService } from '../../services/digest/digest.service';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';

// createBank doesn't touch the lexeme foundation; a no-op stub satisfies the constructor.
const lexemeStub = { wordPoolFor: async () => '', pickForSkill: async () => [] } as unknown as LexemeService;

/** A minimal ItemBank row the selector + mapper can digest. */
function bankItem(id: string, unit: number, skillTags: string[], generatedBy = 'seed') {
  return {
    id,
    unit,
    exerciseType: 'realword',
    payload: { word: 'Horn', answer: 'wort', praise: 'Super!' },
    audioUrl: null,
    syllableAudio: null,
    skillTags,
    difficulty: 1,
    generatedBy,
  };
}

function setup(opts: { weak?: boolean; generated?: ReturnType<typeof bankItem>[] } = {}) {
  const findManyCalls: Array<Record<string, unknown>> = [];
  const unitItems = [
    bankItem('seed-1', 1, ['syllable_validity']),
    bankItem('seed-2', 1, ['visual_discrimination']),
  ];
  const prisma = {
    profile: { findFirst: vi.fn(async () => ({ id: 'p1', accountId: 'a1', unlockedUnit: 1 })) },
    itemBank: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        findManyCalls.push(where);
        return where.unit === 0 ? (opts.generated ?? []) : unitItems;
      }),
    },
    attempt: {
      findMany: vi.fn(async () =>
        opts.weak
          ? Array.from({ length: 4 }, () => ({ skillTags: ['lexical_decision'], isCorrect: false, timeMs: 5000 }))
          : [],
      ),
    },
    reviewState: { findMany: vi.fn(async () => []) },
    session: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'ses-1',
        createdAt: new Date('2026-07-01T12:00:00Z'),
        ...data,
      })),
    },
  } as unknown as PrismaService;
  const llm = { available: false } as unknown as LlmService;
  const digest = {} as unknown as DigestService;
  const config = { get: () => 5 } as unknown as ConfigService<Env, true>;
  return { svc: new SessionsService(prisma, llm, digest, lexemeStub, config), prisma, findManyCalls };
}

describe('SessionsService.createBank — blending generated (unit 0) items', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blends validated unit-0 LLM items matching weak skills into the candidate pool', async () => {
    const gen = bankItem('gen-1', 0, ['lexical_decision'], 'llm');
    const { svc, findManyCalls } = setup({ weak: true, generated: [gen] });

    const res = await svc.createBank('a1', { profileId: 'p1' });

    // second itemBank query targets the generated pool, filtered by the weak skills
    const genQuery = findManyCalls.find((w) => w.unit === 0) as Record<string, any>;
    expect(genQuery).toBeDefined();
    expect(genQuery.generatedBy).toBe('llm');
    expect(genQuery.skillTags).toEqual({ hasSome: ['lexical_decision'] });
    // the priority-matching generated item wins selection
    expect(res.items.map((i) => i.id)).toContain('gen-1');
  });

  it('skips the generated pool entirely when there are no weak/due skills', async () => {
    const { svc, findManyCalls } = setup({ weak: false });
    await svc.createBank('a1', { profileId: 'p1' });
    expect(findManyCalls.some((w) => w.unit === 0)).toBe(false);
    expect(findManyCalls).toHaveLength(1);
  });
});
