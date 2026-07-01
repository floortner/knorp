import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatService } from './chat.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { LlmService } from '../../services/llm/llm.service';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { ApiException } from '../../common/exceptions/api-exception';

function setup(
  opts: { owned?: boolean; rows?: Array<{ role: string; text: string; createdAt: Date }>; sentToday?: number } = {},
) {
  const owned = opts.owned ?? true;
  const created: Array<{ role: string; text: string }> = [];
  const prisma = {
    profile: { findFirst: vi.fn(async () => (owned ? { id: 'p1', accountId: 'a1' } : null)) },
    chatMessage: {
      findMany: vi.fn(async () => opts.rows ?? []),
      count: vi.fn(async () => opts.sentToday ?? 0),
      create: vi.fn(async ({ data }: { data: { role: string; text: string } }) => {
        created.push(data);
        return { ...data, createdAt: new Date('2026-06-30T10:00:00Z') };
      }),
    },
  } as unknown as PrismaService;
  const llm = {
    providerName: 'stub',
    chat: vi.fn(async () => 'Gut gemacht! Welches Wort möchtest du üben?'),
  } as unknown as LlmService;
  const config = { get: () => 60 } as unknown as ConfigService<Env, true>; // CHAT_MESSAGES_PER_DAY
  return { svc: new ChatService(prisma, llm, config), prisma, llm, created };
}

async function statusOf(p: Promise<unknown>): Promise<number | 'ok'> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return (e as ApiException).getStatus();
  }
}

describe('ChatService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404s history/send for a profile the account does not own', async () => {
    const { svc } = setup({ owned: false });
    expect(await statusOf(svc.history('a1', 'p1'))).toBe(404);
    expect(await statusOf(svc.send('a1', 'p1', 'hallo'))).toBe(404);
  });

  it('maps history roles to me (child=true, trainer=false), chronological', async () => {
    const { svc } = setup({
      // query is orderBy createdAt desc (newest first); the service reverses to chronological
      rows: [
        { role: 'child', text: 'Hi', createdAt: new Date('2026-06-30T09:01:00Z') },
        { role: 'trainer', text: 'Hallo!', createdAt: new Date('2026-06-30T09:00:00Z') },
      ],
    });
    const { messages } = await svc.history('a1', 'p1');
    expect(messages).toEqual([
      { me: false, text: 'Hallo!', ts: '2026-06-30T09:00:00.000Z' },
      { me: true, text: 'Hi', ts: '2026-06-30T09:01:00.000Z' },
    ]);
  });

  it('send persists the child message + trainer reply and returns the reply', async () => {
    const { svc, llm, created } = setup();
    const res = await svc.send('a1', 'p1', 'Was ist ein Reim?');
    expect((llm.chat as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce();
    // a child row then a trainer row were written
    expect(created.map((c) => c.role)).toEqual(['child', 'trainer']);
    expect(created[0].text).toBe('Was ist ein Reim?');
    expect(res.reply.me).toBe(false);
    expect(res.reply.text).toContain('Gut gemacht');
  });

  it('429s once the daily chat cap is hit — nothing persisted, no model call', async () => {
    const { svc, llm, created } = setup({ sentToday: 60 });
    expect(await statusOf(svc.send('a1', 'p1', 'hallo'))).toBe(429);
    expect(created).toEqual([]); // the over-cap message is not stored
    expect((llm.chat as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('passes the child-safe persona as the system prompt', async () => {
    const { svc, llm } = setup();
    await svc.send('a1', 'p1', 'hallo');
    const arg = (llm.chat as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg.system).toMatch(/Angelika/);
    expect(arg.system).toMatch(/persönlichen Daten|persönliche Daten|NIE/);
  });
});
