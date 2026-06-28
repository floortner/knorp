import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAccount, type AuthAccount } from '../../common/decorators/current-account.decorator';
import { ApiZodBody, ApiZodResponse } from '../../common/zod-openapi';
import { okSchema } from '../../contract/models';
import { AttemptsService } from './attempts.service';
import { CreateAttemptDto } from './attempts.dto';

@ApiTags('attempts')
@ApiBearerAuth()
@Controller()
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Post('attempts')
  @ApiZodBody(CreateAttemptDto.schema)
  @ApiZodResponse(okSchema)
  record(@CurrentAccount() account: AuthAccount, @Body() dto: CreateAttemptDto) {
    return this.attempts.record(account.id, dto);
  }
}
