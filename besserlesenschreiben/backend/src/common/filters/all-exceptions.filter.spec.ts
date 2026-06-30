import { describe, it, expect } from 'vitest';
import type { ArgumentsHost } from '@nestjs/common';
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
});
