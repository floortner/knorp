import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { Env } from '../../config/env';

const SUPPORTED = ['console', 'ses', 'resend', 'capture'] as const;
type Provider = (typeof SUPPORTED)[number];

/**
 * Login-code delivery (SPEC §4). Providers:
 *   - `console` — DEV ONLY: prints the code to stdout (no email server needed). Must never be
 *     selected in production: printing the code/email is exactly what ARCHITECTURE §6 forbids.
 *   - `ses`     — production (default): Amazon SES v2, auth via the default AWS credential chain (the
 *     IAM instance role — no API key in env/SSM). Requires EMAIL_FROM on a verified SES identity.
 *   - `resend`  — alternative production provider: Resend REST API (needs EMAIL_KEY + EMAIL_FROM).
 *   - `capture` — E2E-TEST ONLY: holds the last code per address in memory (never logged) so a
 *     Playwright test can read it back via the gated `/test/last-login-code` route. Both the family
 *     4-digit and staff 6-digit codes flow through here, so it covers both realms' logins. Permitted
 *     ONLY under `NODE_ENV=test` (rejected at boot otherwise), so it can't be enabled in dev/staging/prod.
 *
 * A selected-but-misconfigured provider FAILS LOUDLY at boot (missing key/from) rather than silently
 * dropping login mails — a silent drop would lock every user out with no signal.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger('EmailService');
  private readonly provider: Provider;
  private readonly key: string;
  private readonly from: string;
  private readonly ses?: SESv2Client;
  /** capture-mode only: email → most-recent plaintext code. Never logged. */
  private readonly captured = new Map<string, string>();

  constructor(config: ConfigService<Env, true>) {
    const provider = config.get('EMAIL_PROVIDER', { infer: true });
    if (!SUPPORTED.includes(provider as Provider)) {
      throw new Error(`Unsupported EMAIL_PROVIDER='${provider}' (expected one of: ${SUPPORTED.join(', ')}).`);
    }
    this.provider = provider as Provider;
    this.key = config.get('EMAIL_KEY', { infer: true });
    this.from = config.get('EMAIL_FROM', { infer: true });

    if (this.provider === 'resend' && (!this.key || !this.from)) {
      throw new Error("EMAIL_PROVIDER='resend' requires EMAIL_KEY and EMAIL_FROM to be set.");
    }
    if (this.provider === 'ses') {
      if (!this.from) {
        throw new Error("EMAIL_PROVIDER='ses' requires EMAIL_FROM (a verified SES identity).");
      }
      // No API key — SES authenticates via the default AWS credential chain (IAM instance role in prod).
      this.ses = new SESv2Client({ region: config.get('AWS_REGION', { infer: true }) });
    }
    // Hard stop: `capture` is an E2E-only provider — it holds login codes in memory and exposes them via
    // an unauthenticated gated route. Permit it ONLY under NODE_ENV=test (fail closed at boot), so a
    // mis-set staging/dev environment (NODE_ENV=development + EMAIL_PROVIDER=capture) can never turn it
    // on. Local dev uses `console`; the E2E harness sets NODE_ENV=test.
    if (this.provider === 'capture' && config.get('NODE_ENV', { infer: true }) !== 'test') {
      throw new Error("EMAIL_PROVIDER='capture' is only permitted under NODE_ENV=test (E2E).");
    }
  }

  /** True only in E2E capture mode — gates the /test/last-login-code route. */
  captureEnabled(): boolean {
    return this.provider === 'capture';
  }

  /** capture-mode only: the last code delivered to `email`, or undefined. */
  lastCapturedCode(email: string): string | undefined {
    return this.captured.get(email);
  }

  async sendLoginCode(email: string, code: string): Promise<void> {
    if (this.provider === 'console') {
      this.logger.log(`📨 [DEV] login code for ${email}: ${code}`);
      return;
    }
    if (this.provider === 'capture') {
      // Keep the code in memory for the test to read back. Deliberately NOT logged (rule #6).
      this.captured.set(email, code);
      return;
    }
    if (this.provider === 'ses') {
      await this.sendViaSes(email, code);
      return;
    }
    await this.sendViaResend(email, code);
  }

  private async sendViaSes(email: string, code: string): Promise<void> {
    const command = new SendEmailCommand({
      FromEmailAddress: this.from,
      Destination: { ToAddresses: [email] },
      Content: {
        Simple: {
          Subject: { Data: `Dein Anmelde-Code: ${code}` },
          Body: {
            Text: { Data: `Dein Code lautet ${code}. Er ist 10 Minuten gültig.` },
            Html: {
              Data: `<p>Dein Code lautet <strong style="font-size:1.4em;letter-spacing:.15em">${code}</strong>.</p><p>Er ist 10 Minuten gültig.</p>`,
            },
          },
        },
      },
    });
    try {
      await this.ses!.send(command);
    } catch {
      // One retry after a short pause. The SDK already retries throttling/5xx internally, but NOT
      // e.g. credential-resolution hiccups right after a process boot (bit the beta on launch night —
      // a login email is too important to lose to a one-off blip). Identifiers only, never the error
      // body (it may echo the recipient — ARCHITECTURE §6).
      this.logger.warn({ event: 'email.retry', provider: 'ses' }, 'SES send failed once — retrying');
      await new Promise((resolve) => setTimeout(resolve, 750));
      await this.ses!.send(command);
    }
    // Identifiers + outcome only — never the recipient or code (ARCHITECTURE §6).
    this.logger.log({ event: 'email.sent', provider: 'ses' }, 'login code sent');
  }

  private async sendViaResend(email: string, code: string): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: email,
        subject: `Dein Anmelde-Code: ${code}`,
        text: `Dein Code lautet ${code}. Er ist 10 Minuten gültig.`,
        html: `<p>Dein Code lautet <strong style="font-size:1.4em;letter-spacing:.15em">${code}</strong>.</p><p>Er ist 10 Minuten gültig.</p>`,
      }),
    });
    if (!res.ok) {
      // Never log the body (may echo the recipient/code) — identifiers + outcome only (ARCHITECTURE §6).
      throw new Error(`Resend send failed with status ${res.status}.`);
    }
    this.logger.log({ event: 'email.sent', provider: 'resend' }, 'login code sent');
  }
}
