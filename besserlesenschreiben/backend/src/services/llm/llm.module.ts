import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { LlmService } from './llm.service';
import { LLM_PROVIDER, type LlmProvider } from './llm.types';
import { StubLlmProvider } from './stub.provider';
import { AnthropicLlmProvider } from './anthropic.provider';

/**
 * Selects the LLM provider: Anthropic-direct when `ANTHROPIC_API_KEY` is set, else the stub. EU-residency
 * gate (ARCHITECTURE §8): in production a key without `LLM_RESIDENCY_ACK=true` throws — no LLM call leaves
 * the box until the data-flow/DPA is acknowledged. Pure + exported so it's unit-testable.
 */
export function createLlmProvider(opts: {
  apiKey: string;
  model: string;
  visionModel?: string;
  isProd: boolean;
  residencyAck: boolean;
}): LlmProvider {
  if (!opts.apiKey) return new StubLlmProvider();
  if (opts.isProd && !opts.residencyAck) {
    throw new Error(
      'Anthropic-direct in production requires LLM_RESIDENCY_ACK=true (EU data-flow / DPA acknowledgement, ARCHITECTURE §8).',
    );
  }
  return new AnthropicLlmProvider({
    apiKey: opts.apiKey,
    model: opts.model,
    visionModel: opts.visionModel || opts.model,
  });
}

/** Wires the selected provider + exports `LlmService` for feature modules (chat, homework, sessions). */
@Module({
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): LlmProvider =>
        createLlmProvider({
          apiKey: config.get('ANTHROPIC_API_KEY', { infer: true }),
          model: config.get('ANTHROPIC_MODEL', { infer: true }),
          visionModel: config.get('ANTHROPIC_VISION_MODEL', { infer: true }),
          isProd: config.get('NODE_ENV', { infer: true }) === 'production',
          residencyAck: config.get('LLM_RESIDENCY_ACK', { infer: true }) === 'true',
        }),
    },
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}
