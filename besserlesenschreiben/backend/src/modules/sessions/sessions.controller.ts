import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAccount, type AuthAccount } from '../../common/decorators/current-account.decorator';
import { ApiZodBody, ApiZodResponse } from '../../common/zod-openapi';
import { sessionCompleteSchema, sessionResponseSchema, unitsSchema } from '../../contract/models';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './sessions.dto';

@ApiTags('sessions')
@ApiBearerAuth()
@Controller()
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get('units')
  @ApiZodResponse(unitsSchema)
  units(@CurrentAccount() account: AuthAccount, @Query('profileId') profileId?: string) {
    return this.sessions.units(account.id, profileId);
  }

  @Post('sessions')
  @ApiZodBody(CreateSessionDto.schema)
  @ApiZodResponse(sessionResponseSchema)
  create(@CurrentAccount() account: AuthAccount, @Body() dto: CreateSessionDto) {
    return this.sessions.createBank(account.id, dto);
  }

  @Post('sessions/:id/complete')
  @ApiZodResponse(sessionCompleteSchema)
  complete(@CurrentAccount() account: AuthAccount, @Param('id') id: string) {
    return this.sessions.complete(account.id, id);
  }
}
