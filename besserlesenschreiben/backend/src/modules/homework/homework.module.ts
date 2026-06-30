import { Module } from '@nestjs/common';
import { LlmModule } from '../../services/llm/llm.module';
import { HomeworkController } from './homework.controller';
import { HomeworkService } from './homework.service';

/** Homework upload + vision draft (family side). StorageService + PrismaService are global; LLM via LlmModule. */
@Module({
  imports: [LlmModule],
  controllers: [HomeworkController],
  providers: [HomeworkService],
})
export class HomeworkModule {}
