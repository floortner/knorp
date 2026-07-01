import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { LlmService } from './llm.service';
import { StubLlmProvider } from './stub.provider';
import { AnthropicLlmProvider } from './anthropic.provider';
import { createLlmProvider } from './llm.module';
import type { LlmProvider } from './llm.types';
import { ApiException } from '../../common/exceptions/api-exception';

const schema = z.object({ topic: z.string(), score: z.number() });

function fakeProvider(over: Partial<LlmProvider> = {}): LlmProvider {
  return {
    name: 'fake',
    live: true,
    chat: vi.fn(async () => 'hi'),
    extractRaw: vi.fn(async () => ({ topic: 'Anlaute', score: 3 })),
    ...over,
  };
}

async function statusOf(p: Promise<unknown>): Promise<number | 'ok'> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return (e as ApiException).getStatus();
  }
}

describe('LlmService', () => {
  it('delegates chat and exposes provider name/availability', async () => {
    const svc = new LlmService(fakeProvider());
    expect(svc.providerName).toBe('fake');
    expect(svc.available).toBe(true);
    expect(await svc.chat({ messages: [{ role: 'user', text: 'hallo' }] })).toBe('hi');
  });

  it('validates structured output against the Zod schema and returns it', async () => {
    const svc = new LlmService(fakeProvider());
    const out = await svc.extract(schema, 'analysis', { messages: [{ role: 'user', text: 'x' }] });
    expect(out).toEqual({ topic: 'Anlaute', score: 3 });
  });

  it('passes the derived JSON schema + name to the provider', async () => {
    const provider = fakeProvider();
    const svc = new LlmService(provider);
    await svc.extract(schema, 'analysis', { messages: [{ role: 'user', text: 'x' }] });
    const arg = (provider.extractRaw as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg.schemaName).toBe('analysis');
    expect(arg.jsonSchema).toMatchObject({ type: 'object' });
  });

  it('re-asks ONCE with the validation error, then accepts the corrected reply', async () => {
    const extractRaw = vi
      .fn()
      .mockResolvedValueOnce({ topic: 'x' /* missing score */ })
      .mockResolvedValueOnce({ topic: 'Anlaute', score: 4 });
    const svc = new LlmService(fakeProvider({ extractRaw }));
    const out = await svc.extract(schema, 'analysis', { messages: [{ role: 'user', text: 'x' }] });
    expect(out).toEqual({ topic: 'Anlaute', score: 4 });
    expect(extractRaw).toHaveBeenCalledTimes(2);
    // the retry carries the prior (bad) answer + a corrective user turn
    const retryMessages = extractRaw.mock.calls[1][0].messages;
    expect(retryMessages.at(-1)).toMatchObject({ role: 'user' });
    expect(retryMessages.at(-1).text).toMatch(/ungültig/i);
  });

  it('rejects an off-contract reply with 502 after the retry also fails (never returns junk)', async () => {
    const extractRaw = vi.fn(async () => ({ topic: 'x' /* always missing score */ }));
    const svc = new LlmService(fakeProvider({ extractRaw }));
    expect(await statusOf(svc.extract(schema, 'analysis', { messages: [] }))).toBe(502);
    expect(extractRaw).toHaveBeenCalledTimes(2);
  });
});

describe('StubLlmProvider', () => {
  it('chat returns a canned reply; extractRaw is 503 (needs a real key)', async () => {
    const stub = new StubLlmProvider();
    expect(stub.live).toBe(false);
    expect(await stub.chat({ messages: [{ role: 'user', text: 'hallo' }] })).toContain('Stub-KI');
    expect(await statusOf(stub.extractRaw({ messages: [], schemaName: 'x', jsonSchema: {} }))).toBe(503);
  });
});

describe('createLlmProvider (selection + EU-residency gate)', () => {
  const base = { model: 'claude-x' };
  it('no key → stub', () => {
    expect(createLlmProvider({ ...base, apiKey: '', isProd: false, residencyAck: false })).toBeInstanceOf(StubLlmProvider);
  });
  it('key + dev → anthropic', () => {
    expect(createLlmProvider({ ...base, apiKey: 'k', isProd: false, residencyAck: false })).toBeInstanceOf(AnthropicLlmProvider);
  });
  it('key + prod without ack → throws (residency gate)', () => {
    expect(() => createLlmProvider({ ...base, apiKey: 'k', isProd: true, residencyAck: false })).toThrow(/LLM_RESIDENCY_ACK/);
  });
  it('key + prod + ack → anthropic', () => {
    expect(createLlmProvider({ ...base, apiKey: 'k', isProd: true, residencyAck: true })).toBeInstanceOf(AnthropicLlmProvider);
  });
});
