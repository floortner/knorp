import { Body, Controller, HttpCode, Post } from '@nestjs/common';
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

  // Idempotent telemetry insert (dedupe on sessionId/itemId/attemptNo) → 200, not the POST default 201.
  @Post('attempts')
  @HttpCode(200)
  @ApiZodBody(CreateAttemptDto.schema)
  @ApiZodResponse(okSchema)
  record(@CurrentAccount() account: AuthAccount, @Body() dto: CreateAttemptDto) {
    return this.attempts.record(account.id, dto);
  }
}
