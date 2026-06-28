import { Global, Module } from '@nestjs/common';
import { FsrsService } from './fsrs.service';

@Global()
@Module({
  providers: [FsrsService],
  exports: [FsrsService],
})
export class FsrsModule {}
