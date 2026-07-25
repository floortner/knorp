import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiZodResponse } from '../../common/zod-openapi';
import {
  studentDetailSchema,
  studentPageSchema,
  studentSessionDetailSchema,
  studentSessionPageSchema,
} from '../../contract/staff';
import { StaffAuthGuard } from '../../common/guards/staff-auth.guard';
import { StudentActivityService } from './student-activity.service';
import { StaffProgressService } from './staff-progress.service';

/**
 * Learner directory + per-student activity (ROADMAP §H1.3 + §H3.1) — ALL trainers (known-trainer
 * model; the 2–3 trainers know each student personally). `@Public()` skips the family JwtAuthGuard;
 * `StaffAuthGuard` at class level keeps every route default-deny to authenticated trainers. Read-only
 * views over the existing session/attempt telemetry; parent email/chat/billing never appear here
 * (account identity/lifecycle stays on the admin-only /staff/users routes).
 */
@Public()
@UseGuards(StaffAuthGuard)
@ApiTags('staff')
@Controller('staff/students')
export class StaffStudentsController {
  constructor(
    private readonly activity: StudentActivityService,
    private readonly progress: StaffProgressService,
  ) {}

  @Get()
  @ApiZodResponse(studentPageSchema)
  list(@Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    const n = limit ? Number.parseInt(limit, 10) : 50;
    return this.activity.directory(Number.isFinite(n) ? n : 50, cursor);
  }

  @Get(':profileId')
  @ApiZodResponse(studentDetailSchema)
  detail(@Param('profileId') profileId: string) {
    return this.progress.forStudent(profileId);
  }

  @Get(':profileId/sessions')
  @ApiZodResponse(studentSessionPageSchema)
  sessions(
    @Param('profileId') profileId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('source') source?: string,
  ) {
    const n = limit ? Number.parseInt(limit, 10) : 50;
    // Loose parse like the queue's status filter: unknown values fall back to "all sources".
    const src = source === 'bank' || source === 'llm' || source === 'homework' || source === 'assigned' ? source : undefined;
    return this.activity.sessions(profileId, { limit: Number.isFinite(n) ? n : 50, cursor, source: src });
  }

  @Get(':profileId/sessions/:sessionId')
  @ApiZodResponse(studentSessionDetailSchema)
  session(@Param('profileId') profileId: string, @Param('sessionId') sessionId: string) {
    return this.activity.sessionDetail(profileId, sessionId);
  }
}
