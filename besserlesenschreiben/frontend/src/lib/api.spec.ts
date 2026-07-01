import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, ApiError, isApiError } from './api';

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiFetch', () => {
  it('returns parsed JSON on success', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { ok: true }));
    await expect(apiFetch('/auth/request-code', { method: 'POST', body: { email: 'a@b.de' } })).resolves.toEqual({
      ok: true,
    });
  });

  it('throws a typed ApiError from the error envelope on non-2xx', async () => {
    vi.stubGlobal('fetch', mockFetch(429, { error: { code: 'RATE_LIMITED', message: 'Zu viele Versuche.', requestId: 'req-1' } }));
    await expect(apiFetch('/auth/verify', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Zu viele Versuche.',
      requestId: 'req-1',
    });
  });

  it('falls back to a generic ApiError when the body has no envelope', async () => {
    vi.stubGlobal('fetch', mockFetch(500, null));
    const err = await apiFetch('/me').catch((e: unknown) => e);
    expect(isApiError(err)).toBe(true);
    expect((err as ApiError).code).toBe('INTERNAL');
  });

  it('attaches a per-request bearer token via the token option', async () => {
    const fetchMock = mockFetch(200, { ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/parent/reset', { method: 'POST', body: {}, token: 'tok-123' });
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer tok-123');
  });

  it('sends no authorization header when no token is given', async () => {
    const fetchMock = mockFetch(200, { ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/me');
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });
});
