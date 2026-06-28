import { Module } from '@nestjs/common';
import { DigestController } from './digest.controller';
import { DigestService } from '../../services/digest/digest.service';

/**
 * Digest feature module. The controller is HTTP-only; the domain logic lives in
 * `services/digest`. DigestService is exported so chat / LLM-session generation can reuse the
 * compact `digest.md` view at their milestones.
 */
@Module({
  controllers: [DigestController],
  providers: [DigestService],
  exports: [DigestService],
})
export class DigestModule {}
