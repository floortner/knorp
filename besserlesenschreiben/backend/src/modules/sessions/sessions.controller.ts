import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAccount, type AuthAccount } from '../../common/decorators/current-account.decorator';
import { ApiZodBody, ApiZodCreatedResponse, ApiZodResponse } from '../../common/zod-openapi';
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
  @HttpCode(201)
  @ApiZodBody(CreateSessionDto.schema)
  @ApiZodCreatedResponse(sessionResponseSchema)
  create(@CurrentAccount() account: AuthAccount, @Body() dto: CreateSessionDto) {
    return this.sessions.createBank(account.id, dto);
  }

  // Idempotent: completing an already-completed session returns the same award → 200, not 201.
  @Post('sessions/:id/complete')
  @HttpCode(200)
  @ApiZodResponse(sessionCompleteSchema)
  complete(@CurrentAccount() account: AuthAccount, @Param('id') id: string) {
    return this.sessions.complete(account.id, id);
  }
}
