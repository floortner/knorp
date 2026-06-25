import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';

/**
 * Login-code delivery. The `console` provider is a DEV-ONLY stub that prints the code to stdout so
 * passwordless login is testable with no email server. Real providers (ACS/Resend/Postmark) are
 * wired here at their milestone.
 *
 * NOTE: printing the code/email is exactly what ARCHITECTURE §6 forbids in production logs — the
 * `console` transport must never be selected outside local development.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger('EmailService');

  constructor(private readonly config: ConfigService<Env, true>) {}

  async sendLoginCode(email: string, code: string): Promise<void> {
    const provider = this.config.get('EMAIL_PROVIDER', { infer: true });
    if (provider === 'console') {
      this.logger.log(`📨 [DEV] login code for ${email}: ${code}`);
      return;
    }
    this.logger.warn(`EMAIL_PROVIDER='${provider}' not implemented — login code not delivered.`);
  }
}
