import { describe, it, expect, vi } from 'vitest';
import { Logger, type ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ApiException } from '../exceptions/api-exception';

function run(exception: unknown): { status: number; body: { error: { code: string; message: string } } } {
  let status = 0;
  let body: unknown;
  const res = {
    header: () => res,
    status: (s: number) => {
      status = s;
      return res;
    },
    send: (b: unknown) => {
      body = b;
      return res;
    },
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ id: 'req-1' }),
      getResponse: () => res,
    }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return { status, body: body as { error: { code: string; message: string } } };
}

describe('AllExceptionsFilter', () => {
  it('surfaces an allowlisted 5xx code (PROVIDER_UNAVAILABLE) with its message', () => {
    const out = run(new ApiException(503, 'PROVIDER_UNAVAILABLE', 'KI ist gerade nicht verfügbar.'));
    expect(out.status).toBe(503);
    expect(out.body.error.code).toBe('PROVIDER_UNAVAILABLE');
    expect(out.body.error.message).toBe('KI ist gerade nicht verfügbar.');
  });

  it('flattens any other 5xx to INTERNAL (no internals leaked)', () => {
    const out = run(new ApiException(500, 'DB_EXPLODED', 'connection string xyz'));
    expect(out.status).toBe(500);
    expect(out.body.error.code).toBe('INTERNAL');
    expect(out.body.error.message).not.toContain('xyz');
  });

  it('a raw non-HttpException → 500 INTERNAL', () => {
    const out = run(new Error('boom secret'));
    expect(out.status).toBe(500);
    expect(out.body.error.code).toBe('INTERNAL');
    expect(out.body.error.message).not.toContain('secret');
  });

  it('passes through a normal 4xx code', () => {
    const out = run(new ApiException(404, 'NOT_FOUND', 'Nicht gefunden.'));
    expect(out.status).toBe(404);
    expect(out.body.error.code).toBe('NOT_FOUND');
  });

  it('logs a PLAIN-OBJECT throw diagnosably — never "[object Object]" (beta launch-night lesson)', () => {
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    class WeirdProviderFailure {
      name = 'CredentialsProviderError';
      message = 'Could not load credentials from any providers';
      statusCode = 500;
      hint = 'not-in-the-curated-list';
    }
    const out = run(new WeirdProviderFailure());
    expect(out.status).toBe(500);
    expect(out.body.error.code).toBe('INTERNAL');

    const logged = errorSpy.mock.calls[0][0] as { err: string };
    expect(logged.err).not.toContain('[object Object]');
    expect(logged.err).toContain('WeirdProviderFailure'); // constructor name
    expect(logged.err).toContain('Could not load credentials'); // curated `message` field
    expect(logged.err).toContain('statusCode=500'); // curated field
    expect(logged.err).toContain('hint'); // non-curated keys appear by NAME only …
    expect(logged.err).not.toContain('not-in-the-curated-list'); // … never by value (PII discipline)
    errorSpy.mockRestore();
  });
});
