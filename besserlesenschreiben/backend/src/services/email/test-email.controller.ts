import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { EmailService } from './email.service';

/**
 * E2E-TEST ONLY. Reads back the login code captured by the `capture` email provider so a Playwright
 * test can complete the passwordless flow (codes are argon2-hashed in the DB — otherwise unreadable).
 *
 * Hard-gated: every route 404s unless `EMAIL_PROVIDER=capture`, which the EmailService permits ONLY
 * under `NODE_ENV=test` (it refuses to boot otherwise). So outside E2E this controller is a dead 404 —
 * it never exposes a code. `@Public()` because the caller has no session yet (it's mid-login).
 */
@ApiExcludeController() // test-only route — kept out of the published contract (routing still works)
@Controller('test')
export class TestEmailController {
  constructor(private readonly email: EmailService) {}

  @Public()
  @Get('last-login-code')
  lastLoginCode(@Query('email') email?: string): { code: string } {
    if (!this.email.captureEnabled()) throw new NotFoundException();
    const code = email ? this.email.lastCapturedCode(email) : undefined;
    if (!code) throw new NotFoundException();
    return { code };
  }
}
