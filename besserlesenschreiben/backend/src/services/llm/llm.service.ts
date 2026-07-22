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

  /**
   * Structured output validated against `schema` (homework analysis, generated exercises, …). Validation
   * now includes SOLVABILITY refinements (src/contract/exercise), so a plausible-but-wrong batch (answer
   * not in options, unknown skill tag) is rejected. To avoid failing a student's session on a single bad
   * batch, we re-ask ONCE with the validation error fed back before surfacing a provider error.
   */
  async extract<T>(schema: ZodType<T>, schemaName: string, req: ExtractRequest): Promise<T> {
    const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Record<string, unknown>;
    let messages = req.messages;

    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await this.provider.extractRaw({ ...req, messages, schemaName, jsonSchema });
      const parsed = schema.safeParse(raw);
      if (parsed.success) return parsed.data;

      // Off-contract. On the first miss, re-ask with the concrete issues; the second miss is terminal.
      if (attempt === 0) {
        const issues = parsed.error.issues
          .map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('\n');
        messages = [
          ...messages,
          { role: 'assistant', text: JSON.stringify(raw) },
          {
            role: 'user',
            text: `Deine vorige Antwort war ungültig:\n${issues}\nGib NUR korrigiertes, gültiges JSON zurück, das dem Schema und der Lösbarkeit entspricht.`,
          },
        ];
        continue;
      }
      // Never persist off-contract content.
      throw new ApiException(502, 'PROVIDER_UNAVAILABLE', 'KI-Antwort hatte ein unerwartetes Format.');
    }
    // Unreachable (the loop returns or throws), but satisfies the type checker.
    throw new ApiException(502, 'PROVIDER_UNAVAILABLE', 'KI-Antwort hatte ein unerwartetes Format.');
  }
}
