import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentAccount,
  AuthAccount,
} from '../../common/decorators/current-account.decorator';
import { ParentScopeGuard } from '../../common/guards/parent-scope.guard';
import { ParentProfileId } from '../../common/decorators/parent-profile.decorator';
import { ApiZodResponse, ApiZodBody } from '../../common/zod-openapi';
import { okSchema, parentTokenSchema, unlockNextSchema } from '../../contract/models';
import { ParentService } from './parent.service';
import { SetPinDto, VerifyPinDto } from './parent.dto';

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
    return this.parent.setPin(account.id, dto.pin, dto.currentPin);
  }

  @Post('verify-pin')
  @HttpCode(200)
  @ApiZodBody(VerifyPinDto.schema)
  @ApiZodResponse(parentTokenSchema)
  verifyPin(@CurrentAccount() account: AuthAccount, @Body() dto: VerifyPinDto) {
    return this.parent.verifyPin(account.id, dto.pin, dto.profileId);
  }

  // ‡ Parent scope required. The target child is read from the parentToken (signed in at verify-pin),
  // never from the request body — so there is no body id to trust here (security §1).
  @Post('unlock-next')
  @HttpCode(200)
  @UseGuards(ParentScopeGuard)
  @ApiZodResponse(unlockNextSchema)
  unlockNext(@CurrentAccount() account: AuthAccount, @ParentProfileId() profileId: string) {
    return this.parent.unlockNext(account.id, profileId);
  }

  @Post('reset')
  @HttpCode(200)
  @UseGuards(ParentScopeGuard)
  @ApiZodResponse(okSchema)
  reset(@CurrentAccount() account: AuthAccount, @ParentProfileId() profileId: string) {
    return this.parent.reset(account.id, profileId);
  }

  // ‡ Parent scope required. Target child read from the parentToken, never the request body (security §1).
  @Post('reset-chat')
  @HttpCode(200)
  @UseGuards(ParentScopeGuard)
  @ApiZodResponse(okSchema)
  resetChat(@CurrentAccount() account: AuthAccount, @ParentProfileId() profileId: string) {
    return this.parent.resetChat(account.id, profileId);
  }
}
