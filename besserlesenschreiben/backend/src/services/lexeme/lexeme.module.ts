import { Global, Module } from '@nestjs/common';
import { LexemeService } from './lexeme.service';

@Global()
@Module({
  providers: [LexemeService],
  exports: [LexemeService],
})
export class LexemeModule {}
