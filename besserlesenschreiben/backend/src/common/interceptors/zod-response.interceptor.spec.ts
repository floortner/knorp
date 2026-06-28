import { describe, it, expect } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import { z } from 'zod';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import { ZodResponseInterceptor } from './zod-response.interceptor';

const schema = z.object({ ok: z.literal(true) });

function make(env: 'development' | 'production', handlerSchema: unknown) {
  const reflector = { get: () => handlerSchema } as unknown as ConstructorParameters<typeof ZodResponseInterceptor>[0];
  const config = { get: () => env } as unknown as ConstructorParameters<typeof ZodResponseInterceptor>[1];
  const interceptor = new ZodResponseInterceptor(reflector, config);
  const ctx = {
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ url: '/x' }) }),
  } as unknown as ExecutionContext;
  return { interceptor, ctx };
}
const handler = (body: unknown): CallHandler => ({ handle: () => of(body) });

describe('ZodResponseInterceptor', () => {
  it('passes a valid body through and strips unknown keys to match the contract', async () => {
    const { interceptor, ctx } = make('development', schema);
    const out = await firstValueFrom(interceptor.intercept(ctx, handler({ ok: true, secret: 'leak' })));
    expect(out).toEqual({ ok: true });
  });

  it('throws on a contract mismatch in non-production (fail loud in dev/CI)', async () => {
    const { interceptor, ctx } = make('development', schema);
    await expect(firstValueFrom(interceptor.intercept(ctx, handler({ ok: false })))).rejects.toThrow();
  });

  it('logs but passes the body through in production (never break a live response)', async () => {
    const { interceptor, ctx } = make('production', schema);
    const out = await firstValueFrom(interceptor.intercept(ctx, handler({ ok: false })));
    expect(out).toEqual({ ok: false });
  });

  it('is a no-op when no schema is registered for the handler', async () => {
    const { interceptor, ctx } = make('development', undefined);
    const out = await firstValueFrom(interceptor.intercept(ctx, handler({ anything: 1 })));
    expect(out).toEqual({ anything: 1 });
  });
});
