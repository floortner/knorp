import { Logger } from '@nestjs/common';
import { ApiException } from '../../common/exceptions/api-exception';
import type { ChatRequest, LlmProvider, ProviderExtractRequest } from './llm.types';

/**
 * Anthropic-direct provider (ARCHITECTURE §8). Structured output is done with a single **forced tool** whose
 * `input_schema` is the JSON Schema of the caller's Zod schema — version-stable across SDK releases and the
 * idiomatic Claude way to get typed JSON. The SDK is lazy-imported so the stub path needs nothing installed
 * at runtime. We never log prompts, child answers, or image bytes (CLAUDE.md §6) — identifiers + outcomes only.
 *
 * Notes for current models (Sonnet 5 / Opus 4.8): `temperature`/`top_p`/`top_k` are rejected (400) — we send
 * none and steer via the prompt. The (byte-stable) system prompt is sent as a cacheable block so repeated
 * calls read it from cache instead of re-billing it. Homework vision uses a stronger `visionModel`.
 */
export class AnthropicLlmProvider implements LlmProvider {
  readonly name = 'anthropic';
  readonly live = true;
  private readonly logger = new Logger('AnthropicLlmProvider');
  private clientPromise: Promise<any> | null = null;

  constructor(private readonly opts: { apiKey: string; model: string; visionModel: string }) {}

  private client(): Promise<any> {
    return (this.clientPromise ??= (async () => {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      return new Anthropic({ apiKey: this.opts.apiKey });
    })());
  }

  /** System prompt as a prompt-cacheable text block (stable prefix → cache reads on repeat calls). */
  private systemBlocks(system?: string): unknown[] | undefined {
    if (!system) return undefined;
    return [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }];
  }

  private wrap(err: unknown): never {
    // Provider/network failure → 503, no internal detail leaked (ARCHITECTURE §5).
    this.logger.warn({ event: 'llm.error', name: (err as Error)?.name }, 'anthropic call failed');
    throw new ApiException(503, 'PROVIDER_UNAVAILABLE', 'KI ist gerade nicht verfügbar. Bitte später erneut.');
  }

  async chat(req: ChatRequest): Promise<string> {
    try {
      const client = await this.client();
      const res = await client.messages.create({
        model: this.opts.model,
        max_tokens: req.maxTokens ?? 1024,
        ...(req.system ? { system: this.systemBlocks(req.system) } : {}),
        messages: req.messages.map((m) => ({ role: m.role, content: m.text })),
      });
      return (res.content as Array<{ type: string; text?: string }>)
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('')
        .trim();
    } catch (err) {
      this.wrap(err);
    }
  }

  async extractRaw(req: ProviderExtractRequest): Promise<unknown> {
    try {
      const client = await this.client();
      // Preserve the multi-turn shape (the re-ask appends assistant+user turns); attach the image, if any,
      // to the FIRST user turn. Assistant turns pass through as plain text.
      let imageAttached = false;
      const messages = req.messages.map((m) => {
        if (m.role === 'user' && req.image && !imageAttached) {
          imageAttached = true;
          return {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: req.image.mediaType, data: req.image.dataBase64 } },
              { type: 'text', text: m.text },
            ],
          };
        }
        return { role: m.role, content: m.text };
      });

      const res = await client.messages.create({
        model: req.image ? this.opts.visionModel : this.opts.model,
        max_tokens: req.maxTokens ?? 4096,
        ...(req.system ? { system: this.systemBlocks(req.system) } : {}),
        tools: [{ name: req.schemaName, description: `Return a single ${req.schemaName} object.`, input_schema: req.jsonSchema }],
        tool_choice: { type: 'tool', name: req.schemaName },
        messages,
      });
      const toolUse = (res.content as Array<{ type: string; input?: unknown }>).find((b) => b.type === 'tool_use');
      if (!toolUse) {
        throw new ApiException(502, 'PROVIDER_UNAVAILABLE', 'KI lieferte kein strukturiertes Ergebnis.');
      }
      return toolUse.input;
    } catch (err) {
      if (err instanceof ApiException) throw err;
      this.wrap(err);
    }
  }
}
