import { Module } from '@nestjs/common';
import { LlmModule } from '../../services/llm/llm.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

/** Trainer chat (free ★ AI). Controller = HTTP only; ChatService talks to PrismaService (global) + LlmService. */
@Module({
  imports: [LlmModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
