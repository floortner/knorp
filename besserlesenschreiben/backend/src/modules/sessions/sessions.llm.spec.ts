import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionsService } from './sessions.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { LlmService } from '../../services/llm/llm.service';
import type { DigestService } from '../../services/digest/digest.service';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { ApiException } from '../../common/exceptions/api-exception';

const genExercise = {
  type: 'count',
  word: 'Sonne',
  syll: ['Son', 'ne'],
  answer: 2,
  opts: [2, 3],
  id: 'placeholder',
  audioUrl: null,
  skillTags: ['syllable_count'],
  praise: 'Super!',
};

function setup(opts: { available?: boolean; usedToday?: number } = {}) {
  const itemCreates: Array<Record<string, unknown>> = [];
  let seq = 0;
  const prisma = {
    profile: { findFirst: vi.fn(async () => ({ id: 'p1', accountId: 'a1', unlockedUnit: 2 })) },
    attempt: { findMany: vi.fn(async () => []) },
    reviewState: { findMany: vi.fn(async () => []) },
    homeworkUpload: { findMany: vi.fn(async () => []) },
    itemBank: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        itemCreates.push(data);
        return {
          id: `item-${++seq}`,
          exerciseType: data.exerciseType,
          payload: data.payload,
          audioUrl: null,
          syllableAudio: null,
          skillTags: data.skillTags,
        };
      }),
    },
    session: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'ses-1', createdAt: new Date('2026-06-30T12:00:00Z'), ...data })),
      count: vi.fn(async () => opts.usedToday ?? 0),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
  } as unknown as PrismaService;
  const llm = {
    available: opts.available ?? true,
    extract: vi.fn(async () => ({ intro: 'Merke: Klatsch die Silben mit!', exercises: [genExercise] })),
  } as unknown as LlmService;
  const digest = { generate: vi.fn(async () => ({ markdown: '## Lernstand' })) } as unknown as DigestService;
  const config = { get: () => 5 } as unknown as ConfigService<Env, true>; // LLM_SESSIONS_PER_DAY
  return { svc: new SessionsService(prisma, llm, digest, config), prisma, llm, digest, itemCreates };
}

describe('SessionsService.createLlm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('503s when no LLM provider is configured (stub)', async () => {
    const { svc } = setup({ available: false });
    await expect(svc.createLlm('a1', { profileId: 'p1', source: 'llm' })).rejects.toMatchObject({});
    try {
      await svc.createLlm('a1', { profileId: 'p1', source: 'llm' });
    } catch (e) {
      expect((e as ApiException).getStatus()).toBe(503);
    }
  });

  it('429s once the profile hit its daily LLM-session cap — no model call, nothing persisted', async () => {
    const { svc, llm, prisma } = setup({ usedToday: 5 });
    try {
      await svc.createLlm('a1', { profileId: 'p1', source: 'llm' });
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as ApiException).getStatus()).toBe(429);
    }
    expect((llm.extract as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    expect((prisma.session.create as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('generates, stores items as generated_by=llm (unit 0), and returns a session', async () => {
    const { svc, prisma, itemCreates, llm } = setup();
    const res = await svc.createLlm('a1', { profileId: 'p1', source: 'llm' });

    expect((llm.extract as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce();
    // item persisted with the backend-owned fields (id/audioUrl stripped from payload)
    expect(itemCreates[0]).toMatchObject({ unit: 0, exerciseType: 'count', generatedBy: 'llm', audioUrl: null });
    expect(itemCreates[0].skillTags).toEqual(['syllable_count']);
    expect((itemCreates[0].payload as Record<string, unknown>).id).toBeUndefined();
    expect((itemCreates[0].payload as Record<string, unknown>).word).toBe('Sonne');
    expect((itemCreates[0].payload as Record<string, unknown>).praise).toBe('Super!');

    expect((prisma.session.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data).toMatchObject({ source: 'llm', unit: 2 });
    // wire item is reconstructed via the mapper: fresh id + type + payload fields
    expect(res.items[0]).toMatchObject({ id: 'item-1', type: 'count', word: 'Sonne', audioUrl: null });
    // the teaching intro rides on the session response (lecture card before exercise 1)
    expect(res).toMatchObject({ profileId: 'p1', unit: 2, intro: 'Merke: Klatsch die Silben mit!' });
  });
});
