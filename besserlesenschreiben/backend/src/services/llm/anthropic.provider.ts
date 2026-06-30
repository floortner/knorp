import { Logger } from '@nestjs/common';
import { ApiException } from '../../common/exceptions/api-exception';
import type { ChatRequest, LlmProvider, ProviderExtractRequest } from './llm.types';

/**
 * Anthropic-direct provider (ARCHITECTURE §8). Structured output is done with a single **forced tool** whose
 * `input_schema` is the JSON Schema of the caller's Zod schema — version-stable across SDK releases and the
 * idiomatic Claude way to get typed JSON. The SDK is lazy-imported so the stub path needs nothing installed
 * at runtime. We never log prompts, child answers, or image bytes (CLAUDE.md §6) — identifiers + outcomes only.
 */
export class AnthropicLlmProvider implements LlmProvider {
  readonly name = 'anthropic';
  readonly live = true;
  private readonly logger = new Logger('AnthropicLlmProvider');
  private clientPromise: Promise<any> | null = null;

  constructor(private readonly opts: { apiKey: string; model: string }) {}

  private client(): Promise<any> {
    return (this.clientPromise ??= (async () => {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      return new Anthropic({ apiKey: this.opts.apiKey });
    })());
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
        ...(req.system ? { system: req.system } : {}),
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
      const content: any[] = [];
      if (req.image) {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: req.image.mediaType, data: req.image.dataBase64 },
        });
      }
      content.push({ type: 'text', text: req.messages.filter((m) => m.role === 'user').map((m) => m.text).join('\n\n') });

      const res = await client.messages.create({
        model: this.opts.model,
        max_tokens: req.maxTokens ?? 2048,
        ...(req.system ? { system: req.system } : {}),
        tools: [{ name: req.schemaName, description: `Return a single ${req.schemaName} object.`, input_schema: req.jsonSchema }],
        tool_choice: { type: 'tool', name: req.schemaName },
        messages: [{ role: 'user', content }],
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
