import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply } from 'fastify';
import { Public } from '../../common/decorators/public.decorator';
import { ApiZodBody, ApiZodResponse } from '../../common/zod-openapi';
import { okSchema, verifyResponseSchema } from '../../contract/models';
import { SESSION_COOKIE, clearSessionCookie, sessionCookieOptions } from '../../common/session-cookie';
import type { Env } from '../../config/env';
import { AuthService } from './auth.service';
import { RequestCodeDto, VerifyDto } from './auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get isProd(): boolean {
    return this.config.get('NODE_ENV', { infer: true }) === 'production';
  }

  @Public()
  @Post('request-code')
  @HttpCode(200)
  @ApiZodBody(RequestCodeDto.schema)
  @ApiZodResponse(okSchema)
  requestCode(@Body() dto: RequestCodeDto) {
    return this.auth.requestCode(dto.email);
  }

  @Public()
  @Post('verify')
  @HttpCode(200)
  @ApiZodBody(VerifyDto.schema)
  @ApiZodResponse(verifyResponseSchema)
  async verify(@Body() dto: VerifyDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.verify(dto.email, dto.code);
    // Browser auth is the httpOnly cookie (survives refresh, kept out of JS). The JWT is NOT returned in
    // the body — a 30-day credential must never reach page JavaScript (security review P1-4).
    reply.setCookie(SESSION_COOKIE, result.token, sessionCookieOptions(this.isProd));
    return { isNewAccount: result.isNewAccount };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiZodResponse(okSchema)
  logout(@Res({ passthrough: true }) reply: FastifyReply) {
    clearSessionCookie(reply, this.isProd);
    return { ok: true as const };
  }
}
