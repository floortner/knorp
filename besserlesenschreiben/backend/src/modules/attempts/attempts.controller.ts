import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAccount, type AuthAccount } from '../../common/decorators/current-account.decorator';
import { AttemptsService } from './attempts.service';
import { CreateAttemptDto } from './attempts.dto';

@ApiTags('attempts')
@ApiBearerAuth()
@Controller()
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Post('attempts')
  record(@CurrentAccount() account: AuthAccount, @Body() dto: CreateAttemptDto) {
    return this.attempts.record(account.id, dto);
  }
}
