import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAccount, type AuthAccount } from '../../common/decorators/current-account.decorator';
import { ApiZodResponse } from '../../common/zod-openapi';
import { progressSchema } from '../../contract/models';
import { ProgressService } from './progress.service';

@ApiTags('progress')
@ApiBearerAuth()
@Controller()
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('progress/:profileId')
  @ApiZodResponse(progressSchema)
  get(@CurrentAccount() account: AuthAccount, @Param('profileId') profileId: string) {
    return this.progress.get(account.id, profileId);
  }
}
