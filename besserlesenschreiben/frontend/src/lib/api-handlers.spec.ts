import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, setApiHandlers } from './api';

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  setApiHandlers({});
});

describe('api status handlers', () => {
  it('invokes onUnauthorized on a 401', async () => {
    vi.stubGlobal('fetch', mockFetch(401, { error: { code: 'UNAUTHENTICATED', message: 'x' } }));
    const onUnauthorized = vi.fn();
    setApiHandlers({ onUnauthorized });
    await expect(apiFetch('/me')).rejects.toThrow();
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('invokes onUnauthorized when the code is SESSION_EXPIRED (even if status differs)', async () => {
    vi.stubGlobal('fetch', mockFetch(401, { error: { code: 'SESSION_EXPIRED', message: 'abgelaufen' } }));
    const onUnauthorized = vi.fn();
    setApiHandlers({ onUnauthorized });
    await apiFetch('/me').catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('invokes onPaymentRequired on a 402', async () => {
    vi.stubGlobal('fetch', mockFetch(402, { error: { code: 'INSUFFICIENT_CREDITS', message: 'x' } }));
    const onPaymentRequired = vi.fn();
    setApiHandlers({ onPaymentRequired });
    await apiFetch('/chat/1', { method: 'POST', body: {} }).catch(() => {});
    expect(onPaymentRequired).toHaveBeenCalledOnce();
  });

  it('does not invoke handlers on success', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { ok: true }));
    const onUnauthorized = vi.fn();
    const onPaymentRequired = vi.fn();
    setApiHandlers({ onUnauthorized, onPaymentRequired });
    await apiFetch('/me');
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(onPaymentRequired).not.toHaveBeenCalled();
  });
});
