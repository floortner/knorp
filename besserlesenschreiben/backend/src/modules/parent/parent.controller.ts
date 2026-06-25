import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentAccount,
  AuthAccount,
} from '../../common/decorators/current-account.decorator';
import { ParentService } from './parent.service';
import { SetPinDto, VerifyPinDto } from './parent.dto';

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
}
