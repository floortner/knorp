import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentAccount,
  AuthAccount,
} from '../../common/decorators/current-account.decorator';
import { ParentScopeGuard } from '../../common/guards/parent-scope.guard';
import { ApiZodBody, ApiZodResponse } from '../../common/zod-openapi';
import { okSchema, parentTokenSchema, unlockNextSchema } from '../../contract/models';
import { ParentService } from './parent.service';
import { ProfileTargetDto, SetPinDto, VerifyPinDto } from './parent.dto';

@ApiTags('parent')
@ApiBearerAuth()
@Controller('parent')
export class ParentController {
  constructor(private readonly parent: ParentService) {}

  @Post('set-pin')
  @HttpCode(200)
  @ApiZodBody(SetPinDto.schema)
  @ApiZodResponse(okSchema)
  setPin(@CurrentAccount() account: AuthAccount, @Body() dto: SetPinDto) {
    return this.parent.setPin(account.id, dto.pin);
  }

  @Post('verify-pin')
  @HttpCode(200)
  @ApiZodBody(VerifyPinDto.schema)
  @ApiZodResponse(parentTokenSchema)
  verifyPin(@CurrentAccount() account: AuthAccount, @Body() dto: VerifyPinDto) {
    return this.parent.verifyPin(account.id, dto.pin);
  }

  // ‡ Parent scope required (a fresh parentToken from verify-pin).
  @Post('unlock-next')
  @HttpCode(200)
  @UseGuards(ParentScopeGuard)
  @ApiZodBody(ProfileTargetDto.schema)
  @ApiZodResponse(unlockNextSchema)
  unlockNext(@CurrentAccount() account: AuthAccount, @Body() dto: ProfileTargetDto) {
    return this.parent.unlockNext(account.id, dto.profileId);
  }

  @Post('reset')
  @HttpCode(200)
  @UseGuards(ParentScopeGuard)
  @ApiZodBody(ProfileTargetDto.schema)
  @ApiZodResponse(okSchema)
  reset(@CurrentAccount() account: AuthAccount, @Body() dto: ProfileTargetDto) {
    return this.parent.reset(account.id, dto.profileId);
  }
}
