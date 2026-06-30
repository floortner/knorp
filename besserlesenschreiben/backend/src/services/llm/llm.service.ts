import { Inject, Injectable } from '@nestjs/common';
import { z, type ZodType } from 'zod';
import { ApiException } from '../../common/exceptions/api-exception';
import { LLM_PROVIDER, type ChatRequest, type ExtractRequest, type LlmProvider } from './llm.types';

/**
 * The one entry point features use for AI (chat, homework vision, LLM session generation). Provider-agnostic
 * (ARCHITECTURE §8); free (no credit hook, ARCHITECTURE §9). Structured output reuses the `src/contract` Zod
 * schemas: the service derives the JSON Schema for the provider and **validates the model's output against the
 * same Zod schema**, so AI-generated content stays typed end-to-end (and a malformed model reply is rejected,
 * never persisted).
 */
@Injectable()
export class LlmService {
  constructor(@Inject(LLM_PROVIDER) private readonly provider: LlmProvider) {}

  /** Which backend is wired (`anthropic` | `stub`). */
  get providerName(): string {
    return this.provider.name;
  }

  /** True when a real model is reachable (false on the stub) — features can degrade gracefully. */
  get available(): boolean {
    return this.provider.live;
  }

  /** Free-form conversational reply (chat tutor). */
  chat(req: ChatRequest): Promise<string> {
    return this.provider.chat(req);
  }

  /** Structured output validated against `schema` (homework analysis, generated exercises, …). */
  async extract<T>(schema: ZodType<T>, schemaName: string, req: ExtractRequest): Promise<T> {
    const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Record<string, unknown>;
    const raw = await this.provider.extractRaw({ ...req, schemaName, jsonSchema });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      // The model returned something off-contract — treat as a provider failure, never persist it.
      throw new ApiException(502, 'PROVIDER_UNAVAILABLE', 'KI-Antwort hatte ein unerwartetes Format.');
    }
    return parsed.data;
  }
}
