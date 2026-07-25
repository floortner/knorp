import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAccount, type AuthAccount } from '../../common/decorators/current-account.decorator';
import { ApiZodResponse } from '../../common/zod-openapi';
import { assignmentsSchema } from '../../contract/models';
import { AssignmentsService } from './assignments.service';

@ApiTags('assignments')
@ApiBearerAuth()
@Controller()
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  /** Open (incl. restartable started) assignments for one owned profile — the /lernen card data. */
  @Get('assignments')
  @ApiZodResponse(assignmentsSchema)
  list(@CurrentAccount() account: AuthAccount, @Query('profileId') profileId = '') {
    return this.assignments.list(account.id, profileId);
  }
}
