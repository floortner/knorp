import { describe, it, expect, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { EmailService } from './email.service';

/** Minimal ConfigService stub returning the given env values. */
function cfg(values: Partial<Env>): ConfigService<Env, true> {
  return { get: (k: keyof Env) => values[k] ?? '' } as unknown as ConfigService<Env, true>;
}

describe('EmailService construction', () => {
  it('accepts the console provider with no key', () => {
    expect(() => new EmailService(cfg({ EMAIL_PROVIDER: 'console' }))).not.toThrow();
  });

  it('rejects an unsupported provider (fail loudly, not silently no-op)', () => {
    expect(() => new EmailService(cfg({ EMAIL_PROVIDER: 'postmark' }))).toThrow(/Unsupported EMAIL_PROVIDER/);
  });

  it('rejects resend without a key/from', () => {
    expect(() => new EmailService(cfg({ EMAIL_PROVIDER: 'resend' }))).toThrow(/requires EMAIL_KEY and EMAIL_FROM/);
    expect(() => new EmailService(cfg({ EMAIL_PROVIDER: 'resend', EMAIL_KEY: 'k' }))).toThrow();
  });

  it('permits the capture provider ONLY under NODE_ENV=test — a mis-set dev/prod env cannot enable it', () => {
    expect(() => new EmailService(cfg({ EMAIL_PROVIDER: 'capture', NODE_ENV: 'test' }))).not.toThrow();
    expect(new EmailService(cfg({ EMAIL_PROVIDER: 'capture', NODE_ENV: 'test' })).captureEnabled()).toBe(true);
    for (const env of ['development', 'production'] as const) {
      expect(() => new EmailService(cfg({ EMAIL_PROVIDER: 'capture', NODE_ENV: env }))).toThrow(/NODE_ENV=test/);
    }
  });
});

describe('EmailService.sendLoginCode', () => {
  it('console provider prints, never calls the network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const svc = new EmailService(cfg({ EMAIL_PROVIDER: 'console' }));
    await svc.sendLoginCode('a@b.de', '1234');
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('resend provider POSTs to the Resend API and throws on a non-ok response', async () => {
    const ok = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', ok);
    const svc = new EmailService(cfg({ EMAIL_PROVIDER: 'resend', EMAIL_KEY: 'k', EMAIL_FROM: 'x@y.de' }));
    await svc.sendLoginCode('a@b.de', '1234');
    expect(ok).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ method: 'POST' }));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(svc.sendLoginCode('a@b.de', '1234')).rejects.toThrow(/status 500/);
    vi.unstubAllGlobals();
  });
});
