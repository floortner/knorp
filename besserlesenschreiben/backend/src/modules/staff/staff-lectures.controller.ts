import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiZodBody, ApiZodResponse } from '../../common/zod-openapi';
import { okSchema } from '../../contract/models';
import {
  assignResultSchema,
  lectureAssignmentListSchema,
  lectureDetailSchema,
  lecturePageSchema,
} from '../../contract/staff';
import { StaffAuthGuard } from '../../common/guards/staff-auth.guard';
import { CurrentTrainer, type AuthTrainer } from '../../common/decorators/current-trainer.decorator';
import { LecturesService } from './lectures.service';
import { AssignDto } from './staff.dto';

/**
 * Lecture browse + assignment (ROADMAP §H1/§I3) — ALL trainers (known-trainer model). Lectures are
 * authored in the content library (content/, §I) and imported by the deploy; the portal reads them
 * and manages assignments — the write routes (create/update/delete/publish) were removed with §I3.
 * `@Public()` skips the family JwtAuthGuard and the class-level StaffAuthGuard keeps every route
 * default-deny. Assigner identity comes ONLY from the staff token.
 */
@Public()
@UseGuards(StaffAuthGuard)
@ApiTags('staff')
@Controller('staff/lectures')
export class StaffLecturesController {
  constructor(private readonly lectures: LecturesService) {}

  @Get()
  @ApiZodResponse(lecturePageSchema)
  list(@Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    const n = limit ? Number.parseInt(limit, 10) : 50;
    return this.lectures.list(Number.isFinite(n) ? n : 50, cursor);
  }

  @Get(':lectureId')
  @ApiZodResponse(lectureDetailSchema)
  detail(@Param('lectureId') lectureId: string) {
    return this.lectures.detail(lectureId);
  }

  @Post(':lectureId/assignments')
  @HttpCode(200)
  @ApiZodBody(AssignDto.schema)
  @ApiZodResponse(assignResultSchema)
  assign(
    @CurrentTrainer() trainer: AuthTrainer,
    @Param('lectureId') lectureId: string,
    @Body() dto: AssignDto,
  ) {
    return this.lectures.assign(trainer.id, lectureId, dto.profileIds);
  }

  @Get(':lectureId/assignments')
  @ApiZodResponse(lectureAssignmentListSchema)
  assignments(@Param('lectureId') lectureId: string) {
    return this.lectures.assignments(lectureId);
  }

  @Delete(':lectureId/assignments/:assignmentId')
  @HttpCode(200)
  @ApiZodResponse(okSchema)
  withdraw(@Param('lectureId') lectureId: string, @Param('assignmentId') assignmentId: string) {
    return this.lectures.withdraw(lectureId, assignmentId);
  }
}
