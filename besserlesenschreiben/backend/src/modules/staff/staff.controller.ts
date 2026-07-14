import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply } from 'fastify';
import { Public } from '../../common/decorators/public.decorator';
import { StaffPublic } from '../../common/decorators/staff-public.decorator';
import { ApiZodBody, ApiZodResponse } from '../../common/zod-openapi';
import { okSchema } from '../../contract/models';
import {
  claimResponseSchema,
  queuePageSchema,
  queueProgressSchema,
  reviewSubmitResponseSchema,
  staffMeSchema,
} from '../../contract/staff';
import { StaffAuthGuard } from '../../common/guards/staff-auth.guard';
import { StaffAdminGuard } from '../../common/guards/staff-admin.guard';
import { CurrentReviewer, type AuthReviewer } from '../../common/decorators/current-reviewer.decorator';
import { STAFF_COOKIE, clearStaffCookie, staffCookieOptions } from '../../common/staff-cookie';
import type { Env } from '../../config/env';
import { StaffAuthService } from './staff-auth.service';
import { ReviewService, type QueueFilter } from './review.service';
import { StaffProgressService } from './staff-progress.service';
import { ReviewSubmitDto, StaffRequestCodeDto, StaffUpdateMeDto, StaffVerifyDto } from './staff.dto';

/**
 * STAFF realm routes (ARCHITECTURE §1a). `@Public()` skips the GLOBAL family `JwtAuthGuard` (a family JWT
 * is never accepted here); `StaffAuthGuard` is applied at the CLASS level so every route is default-deny.
 * The auth endpoints opt out with `@StaffPublic()` — so a newly-added staff route is protected unless it
 * explicitly says otherwise. Reviewer id always comes from the staff token, never the request.
 */
@Public()
@UseGuards(StaffAuthGuard)
@ApiTags('staff')
@Controller('staff')
export class StaffController {
  constructor(
    private readonly auth: StaffAuthService,
    private readonly review: ReviewService,
    private readonly progress: StaffProgressService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get isProd(): boolean {
    return this.config.get('NODE_ENV', { infer: true }) === 'production';
  }

  // ── Auth (opted out of StaffAuthGuard via @StaffPublic) ───────────────────────
  @StaffPublic()
  @Post('auth/request-code')
  @HttpCode(200)
  @ApiZodBody(StaffRequestCodeDto.schema)
  @ApiZodResponse(okSchema)
  requestCode(@Body() dto: StaffRequestCodeDto) {
    return this.auth.requestCode(dto.email);
  }

  @StaffPublic()
  @Post('auth/verify')
  @HttpCode(200)
  @ApiZodBody(StaffVerifyDto.schema)
  @ApiZodResponse(staffMeSchema)
  async verify(@Body() dto: StaffVerifyDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const { token, me } = await this.auth.verify(dto.email, dto.code);
    reply.setCookie(STAFF_COOKIE, token, staffCookieOptions(this.isProd));
    return me;
  }

  @StaffPublic()
  @Post('auth/logout')
  @HttpCode(200)
  @ApiZodResponse(okSchema)
  logout(@Res({ passthrough: true }) reply: FastifyReply) {
    clearStaffCookie(reply, this.isProd);
    return { ok: true as const };
  }

  // ── Gated (staff JWT, via the class-level StaffAuthGuard) ──────────────────────
  @Get('me')
  @ApiZodResponse(staffMeSchema)
  me(@CurrentReviewer() reviewer: AuthReviewer) {
    return this.auth.me(reviewer.id);
  }

  /** Update the caller's OWN profile (display name). Reviewer id from the staff JWT, never the body. */
  @Patch('me')
  @ApiZodBody(StaffUpdateMeDto.schema)
  @ApiZodResponse(staffMeSchema)
  updateMe(@CurrentReviewer() reviewer: AuthReviewer, @Body() dto: StaffUpdateMeDto) {
    return this.auth.updateMe(reviewer.id, dto.name);
  }

  @Get('queue')
  @ApiZodResponse(queuePageSchema)
  queue(
    @CurrentReviewer() reviewer: AuthReviewer,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
  ) {
    const n = limit ? Number.parseInt(limit, 10) : 50;
    const filter: QueueFilter = status === 'done' || status === 'all' ? status : 'open';
    return this.review.queue(reviewer.id, Number.isFinite(n) ? n : 50, cursor, filter);
  }

  /** Pseudonymised learner progress for a queued upload (ADMIN only) — review context, never a name. */
  @Get('queue/:uploadId/progress')
  @UseGuards(StaffAdminGuard)
  @ApiZodResponse(queueProgressSchema)
  queueProgress(@Param('uploadId') uploadId: string) {
    return this.progress.forUpload(uploadId);
  }

  @Post('queue/:uploadId/claim')
  @HttpCode(200)
  @ApiZodResponse(claimResponseSchema)
  claim(@CurrentReviewer() reviewer: AuthReviewer, @Param('uploadId') uploadId: string) {
    return this.review.claim(reviewer.id, uploadId);
  }

  @Post('queue/:uploadId/release')
  @HttpCode(200)
  @ApiZodResponse(okSchema)
  release(@CurrentReviewer() reviewer: AuthReviewer, @Param('uploadId') uploadId: string) {
    return this.review.release(reviewer.id, uploadId);
  }

  @Post('reviews/:uploadId')
  @HttpCode(200)
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
