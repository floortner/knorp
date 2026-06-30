import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAccount, type AuthAccount } from '../../common/decorators/current-account.decorator';
import { ApiZodBody, ApiZodResponse } from '../../common/zod-openapi';
import { chatHistorySchema, chatReplySchema } from '../../contract/models';
import { ChatService } from './chat.service';
import { SendChatDto } from './chat.dto';

/**
 * Trainer chat (free ★ AI). Both routes are profile-scoped; ownership is verified from the JWT account.
 * POST is 200 (not 201) — it appends to a conversation rather than creating an addressable resource.
 */
@ApiTags('chat')
@ApiBearerAuth()
@Controller()
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('chat/:profileId')
  @ApiZodResponse(chatHistorySchema)
  history(@CurrentAccount() account: AuthAccount, @Param('profileId') profileId: string) {
    return this.chat.history(account.id, profileId);
  }

  @Post('chat/:profileId')
  @HttpCode(200)
  @ApiZodBody(SendChatDto.schema)
  @ApiZodResponse(chatReplySchema)
  send(
    @CurrentAccount() account: AuthAccount,
    @Param('profileId') profileId: string,
    @Body() dto: SendChatDto,
  ) {
    return this.chat.send(account.id, profileId, dto.text);
  }
}
