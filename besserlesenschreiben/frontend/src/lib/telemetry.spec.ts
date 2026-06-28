import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pendingAttempts, recordAttempt } from './telemetry';
import type { CreateAttemptBody } from './types';

function attempt(over: Partial<CreateAttemptBody> = {}): CreateAttemptBody {
  return {
    sessionId: 's1',
    itemId: 'i1',
    exerciseType: 'count',
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
});
