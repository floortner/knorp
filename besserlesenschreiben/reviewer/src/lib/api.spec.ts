import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, setApiHandlers } from './api';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body === null ? null : JSON.stringify(body), { status })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  setApiHandlers({});
});

describe('apiFetch (staff transport)', () => {
  it('returns the parsed body on 2xx', async () => {
    mockFetch(200, { reviewerId: 'r1', name: 'Dana', role: 'reviewer' });
    await expect(apiFetch('/staff/me')).resolves.toEqual({
      reviewerId: 'r1',
      name: 'Dana',
      role: 'reviewer',
    });
  });

  it('throws a normalised ApiError from the error envelope', async () => {
    mockFetch(409, { error: { code: 'CONFLICT', message: 'Bereits beansprucht', requestId: 'req_1' } });
    await expect(apiFetch('/staff/queue/x/claim', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      requestId: 'req_1',
    });
  });

  it('fires the onUnauthorized handler on 401', async () => {
    const onUnauthorized = vi.fn();
    setApiHandlers({ onUnauthorized });
    mockFetch(401, { error: { code: 'UNAUTHENTICATED', message: 'nope' } });
    await expect(apiFetch('/staff/me')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
