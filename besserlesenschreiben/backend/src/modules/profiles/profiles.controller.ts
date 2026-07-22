import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentAccount,
  AuthAccount,
} from '../../common/decorators/current-account.decorator';
import { ApiZodBody, ApiZodCreatedResponse, ApiZodResponse } from '../../common/zod-openapi';
import { meSchema, okSchema, profileDetailSchema, profileEnvelopeSchema } from '../../contract/models';
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
  @HttpCode(201)
  @ApiZodBody(CreateProfileDto.schema)
  @ApiZodCreatedResponse(profileEnvelopeSchema)
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

  // Destructive; ownership of :id is asserted against the JWT account (missing/foreign → 404).
  // The UI fronts both with a two-step confirmation — there is no PIN gate (frontend SPEC §8).
  @Post('profiles/:id/reset')
  @HttpCode(200)
  @ApiZodResponse(okSchema)
  reset(@CurrentAccount() account: AuthAccount, @Param('id') id: string) {
    return this.profiles.reset(account.id, id);
  }

  @Post('profiles/:id/reset-chat')
  @HttpCode(200)
  @ApiZodResponse(okSchema)
  resetChat(@CurrentAccount() account: AuthAccount, @Param('id') id: string) {
    return this.profiles.resetChat(account.id, id);
  }
}
