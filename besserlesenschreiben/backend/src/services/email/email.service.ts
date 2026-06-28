import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';

const SUPPORTED = ['console', 'resend'] as const;
type Provider = (typeof SUPPORTED)[number];

/**
 * Login-code delivery (SPEC §4). Two providers:
 *   - `console` — DEV ONLY: prints the code to stdout (no email server needed). Must never be
 *     selected in production: printing the code/email is exactly what ARCHITECTURE §6 forbids.
 *   - `resend`  — production: Resend REST API (no SDK dependency, just fetch).
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
  }

  async sendLoginCode(email: string, code: string): Promise<void> {
    if (this.provider === 'console') {
      this.logger.log(`📨 [DEV] login code for ${email}: ${code}`);
      return;
    }
    await this.sendViaResend(email, code);
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
