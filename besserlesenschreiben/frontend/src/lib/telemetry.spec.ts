import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pendingAttempts, recordAttempt } from './telemetry';
import type { CreateAttemptBody } from './types';

function attempt(over: Partial<CreateAttemptBody> = {}): CreateAttemptBody {
  return {
    sessionId: 's1',
    itemId: 'i1',
    exerciseType: 'findvowel',
    prompt: 'Sommer',
    expected: '2',
    given: '2',
    isCorrect: true,
    timeMs: 1200,
    attemptNo: 1,
    skillTags: ['syllable_count'],
    ...over,
  };
}

const ok = () => ({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) }) as unknown as Response;
const offline = () => Promise.reject(new TypeError('offline'));

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
afterEach(() => localStorage.clear());

describe('telemetry queue', () => {
  it('keeps an attempt queued when the network is down', async () => {
    const fetchMock = vi.fn().mockImplementation(offline);
    vi.stubGlobal('fetch', fetchMock);
    recordAttempt(attempt());
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(pendingAttempts()).toBe(1);
  });

  it('replays the whole queue on reconnect', async () => {
    const fetchMock = vi.fn().mockImplementation(offline);
    vi.stubGlobal('fetch', fetchMock);
    recordAttempt(attempt({ itemId: 'i1' }));
    recordAttempt(attempt({ itemId: 'i2' }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(pendingAttempts()).toBe(2);

    fetchMock.mockClear();
    fetchMock.mockImplementation(() => Promise.resolve(ok()));
    window.dispatchEvent(new Event('online'));

    await vi.waitFor(() => expect(pendingAttempts()).toBe(0));
    const deliveredIds = new Set(
      fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string).itemId),
    );
    expect(deliveredIds).toEqual(new Set(['i1', 'i2']));
  });

  it('drops a non-retryable 4xx so it cannot wedge the queue', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ error: { code: 'VALIDATION_ERROR', message: 'bad' } }),
      }),
    );
    recordAttempt(attempt());
    await vi.waitFor(() => expect(pendingAttempts()).toBe(0));
  });

  it('sends immediately when online', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(ok()));
    vi.stubGlobal('fetch', fetchMock);
    recordAttempt(attempt());
    await vi.waitFor(() => expect(pendingAttempts()).toBe(0));
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not put queuedAt on the wire', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(ok()));
    vi.stubGlobal('fetch', fetchMock);
    recordAttempt(attempt());
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent).not.toHaveProperty('queuedAt');
  });

  it('purges entries older than the 48h retention window on enqueue', () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(offline));
    // Hand-seed a stale entry directly in storage (queuedAt 3 days ago).
    const stale = { ...attempt({ itemId: 'old' }), queuedAt: Date.now() - 3 * 24 * 60 * 60 * 1000 };
    localStorage.setItem('blsb.attempts.queue', JSON.stringify([stale]));
    recordAttempt(attempt({ itemId: 'fresh' })); // a fresh enqueue prunes synchronously
    // network is down, so the fresh one stays queued and the stale one is gone
    const queued = JSON.parse(localStorage.getItem('blsb.attempts.queue')!) as { itemId: string }[];
    expect(queued.map((q) => q.itemId)).toEqual(['fresh']);
  });
});
