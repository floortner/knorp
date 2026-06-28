import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentAccount,
  AuthAccount,
} from '../../common/decorators/current-account.decorator';
import { ApiZodBody, ApiZodResponse } from '../../common/zod-openapi';
import { meSchema, profileDetailSchema, profileEnvelopeSchema } from '../../contract/models';
import { ProfilesService } from './profiles.service';
import { CreateProfileDto, UpdateSettingsDto } from './profiles.dto';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller()
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('me')
  @ApiZodResponse(meSchema)
  getMe(@CurrentAccount() account: AuthAccount) {
    return this.profiles.getMe(account.id);
  }

  @Post('profiles')
  @ApiZodBody(CreateProfileDto.schema)
  @ApiZodResponse(profileEnvelopeSchema)
  create(@CurrentAccount() account: AuthAccount, @Body() dto: CreateProfileDto) {
    return this.profiles.create(account.id, dto);
  }

  @Get('profiles/:id')
  @ApiZodResponse(profileDetailSchema)
  get(@CurrentAccount() account: AuthAccount, @Param('id') id: string) {
    return this.profiles.get(account.id, id);
  }

  @Patch('profiles/:id/settings')
  @ApiZodBody(UpdateSettingsDto.schema)
  @ApiZodResponse(profileEnvelopeSchema)
  updateSettings(
    @CurrentAccount() account: AuthAccount,
    @Param('id') id: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.profiles.updateSettings(account.id, id, dto);
  }
}
