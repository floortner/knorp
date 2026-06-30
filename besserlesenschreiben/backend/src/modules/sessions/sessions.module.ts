import { Module } from '@nestjs/common';
import { LlmModule } from '../../services/llm/llm.module';
import { DigestModule } from '../digest/digest.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [LlmModule, DigestModule],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
