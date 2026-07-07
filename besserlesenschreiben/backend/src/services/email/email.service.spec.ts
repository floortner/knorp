import { describe, it, expect, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { EmailService } from './email.service';

// Mock the SES SDK so construction/send never touch AWS.
const { sesSend } = vi.hoisted(() => ({ sesSend: vi.fn() }));
vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: vi.fn(() => ({ send: sesSend })),
  SendEmailCommand: vi.fn((input: unknown) => ({ __cmd: input })),
}));

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

  it('rejects ses without a from, accepts it with one (no key needed — IAM role auth)', () => {
    expect(() => new EmailService(cfg({ EMAIL_PROVIDER: 'ses' }))).toThrow(/requires EMAIL_FROM/);
    expect(() => new EmailService(cfg({ EMAIL_PROVIDER: 'ses', EMAIL_FROM: 'login@blesen.app' }))).not.toThrow();
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

  it('ses provider sends via SESv2 (no network fetch) with the recipient + sender set', async () => {
    sesSend.mockClear().mockResolvedValue({});
    const svc = new EmailService(cfg({ EMAIL_PROVIDER: 'ses', EMAIL_FROM: 'login@blesen.app', AWS_REGION: 'eu-central-1' }));
    await svc.sendLoginCode('a@b.de', '1234');
    expect(sesSend).toHaveBeenCalledWith(
      expect.objectContaining({
        __cmd: expect.objectContaining({
          FromEmailAddress: 'login@blesen.app',
          Destination: { ToAddresses: ['a@b.de'] },
        }),
      }),
    );
  });

  it('ses retries ONCE after a transient failure (login email too important for a one-off blip)', async () => {
    vi.useFakeTimers();
    sesSend.mockClear().mockRejectedValueOnce(new Error('cold-boot blip')).mockResolvedValueOnce({});
    const svc = new EmailService(cfg({ EMAIL_PROVIDER: 'ses', EMAIL_FROM: 'login@blesen.app', AWS_REGION: 'eu-central-1' }));
    const pending = svc.sendLoginCode('a@b.de', '1234');
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBeUndefined();
    expect(sesSend).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('ses gives up after the second failure (fail loud, never silently drop a login email)', async () => {
    vi.useFakeTimers();
    sesSend.mockClear().mockRejectedValue(new Error('hard down'));
    const svc = new EmailService(cfg({ EMAIL_PROVIDER: 'ses', EMAIL_FROM: 'login@blesen.app', AWS_REGION: 'eu-central-1' }));
    const pending = svc.sendLoginCode('a@b.de', '1234');
    pending.catch(() => undefined); // observe early so the rejection is never "unhandled"
    await vi.runAllTimersAsync();
    await expect(pending).rejects.toThrow('hard down');
    expect(sesSend).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
