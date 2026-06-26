import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAccount, type AuthAccount } from '../../common/decorators/current-account.decorator';
import { DigestService } from '../../services/digest/digest.service';

@ApiTags('digest')
@ApiBearerAuth()
@Controller()
export class DigestController {
  constructor(private readonly digest: DigestService) {}

  @Get('digest/:profileId')
  get(@CurrentAccount() account: AuthAccount, @Param('profileId') profileId: string) {
    return this.digest.generate(account.id, profileId);
  }
}
