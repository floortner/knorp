import { Module } from '@nestjs/common';
import { DigestService } from '../../services/digest/digest.service';

/**
 * Digest module — INTERNAL only since 2026-08-06. The `GET /digest/{profileId}` route was removed:
 * its only consumer was the Eltern-Bereich, gone since 2026-07-22 (HISTORY.md), and no SPA ever
 * called it again. DigestService stays exported — LLM-session generation renders `digest.md`
 * through it (sessions.service).
 */
@Module({
  providers: [DigestService],
  exports: [DigestService],
})
export class DigestModule {}
