import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { TestEmailController } from './test-email.controller';

@Global()
@Module({
  controllers: [TestEmailController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
