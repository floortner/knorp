import { Body, Controller, Get, HttpCode, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply } from 'fastify';
import { Public } from '../../common/decorators/public.decorator';
import { ApiZodBody, ApiZodResponse } from '../../common/zod-openapi';
import { okSchema } from '../../contract/models';
import {
  claimResponseSchema,
  queuePageSchema,
  reviewSubmitResponseSchema,
  staffMeSchema,
} from '../../contract/staff';
import { StaffAuthGuard } from '../../common/guards/staff-auth.guard';
import { CurrentReviewer, type AuthReviewer } from '../../common/decorators/current-reviewer.decorator';
import { STAFF_COOKIE, clearStaffCookie, staffCookieOptions } from '../../common/staff-cookie';
import type { Env } from '../../config/env';
import { StaffAuthService } from './staff-auth.service';
import { ReviewService } from './review.service';
import { ReviewSubmitDto, StaffRequestCodeDto, StaffVerifyDto } from './staff.dto';

/**
 * STAFF realm routes (ARCHITECTURE §1a). The whole controller is `@Public()` so the GLOBAL family
 * `JwtAuthGuard` is skipped — a family JWT is never accepted here. The gated routes instead enforce
 * `StaffAuthGuard` (staff cookie/JWT). Reviewer id always comes from the staff token, never the request.
 */
@Public()
@ApiTags('staff')
@Controller('staff')
export class StaffController {
  constructor(
    private readonly auth: StaffAuthService,
    private readonly review: ReviewService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get isProd(): boolean {
    return this.config.get('NODE_ENV', { infer: true }) === 'production';
  }

  // ── Auth (open) ──────────────────────────────────────────────────────────────
  @Post('auth/request-code')
  @HttpCode(200)
  @ApiZodBody(StaffRequestCodeDto.schema)
  @ApiZodResponse(okSchema)
  requestCode(@Body() dto: StaffRequestCodeDto) {
    return this.auth.requestCode(dto.email);
  }

  @Post('auth/verify')
  @HttpCode(200)
  @ApiZodBody(StaffVerifyDto.schema)
  @ApiZodResponse(staffMeSchema)
  async verify(@Body() dto: StaffVerifyDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const { token, me } = await this.auth.verify(dto.email, dto.code);
    reply.setCookie(STAFF_COOKIE, token, staffCookieOptions(this.isProd));
    return me;
  }

  @Post('auth/logout')
  @HttpCode(200)
  @ApiZodResponse(okSchema)
  logout(@Res({ passthrough: true }) reply: FastifyReply) {
    clearStaffCookie(reply, this.isProd);
    return { ok: true as const };
  }

  // ── Gated (staff JWT) ────────────────────────────────────────────────────────
  @Get('me')
  @UseGuards(StaffAuthGuard)
  @ApiZodResponse(staffMeSchema)
  me(@CurrentReviewer() reviewer: AuthReviewer) {
    return this.auth.me(reviewer.id);
  }

  @Get('queue')
  @UseGuards(StaffAuthGuard)
  @ApiZodResponse(queuePageSchema)
  queue(@Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    const n = limit ? Number.parseInt(limit, 10) : 50;
    return this.review.queue(Number.isFinite(n) ? n : 50, cursor);
  }

  @Post('queue/:uploadId/claim')
  @HttpCode(200)
  @UseGuards(StaffAuthGuard)
  @ApiZodResponse(claimResponseSchema)
  claim(@CurrentReviewer() reviewer: AuthReviewer, @Param('uploadId') uploadId: string) {
    return this.review.claim(reviewer.id, uploadId);
  }

  @Post('reviews/:uploadId')
  @HttpCode(200)
  @UseGuards(StaffAuthGuard)
  @ApiZodBody(ReviewSubmitDto.schema)
  @ApiZodResponse(reviewSubmitResponseSchema)
  submit(
    @CurrentReviewer() reviewer: AuthReviewer,
    @Param('uploadId') uploadId: string,
    @Body() dto: ReviewSubmitDto,
  ) {
    return this.review.submit(reviewer.id, uploadId, dto);
  }
}
