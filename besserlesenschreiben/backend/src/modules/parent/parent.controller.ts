import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentAccount,
  AuthAccount,
} from '../../common/decorators/current-account.decorator';
import { ParentScopeGuard } from '../../common/guards/parent-scope.guard';
import { ParentService } from './parent.service';
import { ProfileTargetDto, SetPinDto, VerifyPinDto } from './parent.dto';

@ApiTags('parent')
@ApiBearerAuth()
@Controller('parent')
export class ParentController {
  constructor(private readonly parent: ParentService) {}

  @Post('set-pin')
  @HttpCode(200)
  setPin(@CurrentAccount() account: AuthAccount, @Body() dto: SetPinDto) {
    return this.parent.setPin(account.id, dto.pin);
  }

  @Post('verify-pin')
  @HttpCode(200)
  verifyPin(@CurrentAccount() account: AuthAccount, @Body() dto: VerifyPinDto) {
    return this.parent.verifyPin(account.id, dto.pin);
  }

  // ‡ Parent scope required (a fresh parentToken from verify-pin).
  @Post('unlock-next')
  @HttpCode(200)
  @UseGuards(ParentScopeGuard)
  unlockNext(@CurrentAccount() account: AuthAccount, @Body() dto: ProfileTargetDto) {
    return this.parent.unlockNext(account.id, dto.profileId);
  }

  @Post('reset')
  @HttpCode(200)
  @UseGuards(ParentScopeGuard)
  reset(@CurrentAccount() account: AuthAccount, @Body() dto: ProfileTargetDto) {
    return this.parent.reset(account.id, dto.profileId);
  }
}
