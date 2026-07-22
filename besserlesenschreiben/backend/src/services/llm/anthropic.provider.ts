import { Logger } from '@nestjs/common';
import { ApiException } from '../../common/exceptions/api-exception';
import type { ChatRequest, LlmProvider, ProviderExtractRequest } from './llm.types';

/** Token counts of one Anthropic call — identifiers + counts only, never content (CLAUDE.md rule 6). */
export interface LlmUsage {
  op: 'chat' | 'extract';
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/**
 * Anthropic-direct provider (ARCHITECTURE §8). Structured output is done with a single **forced tool** whose
 * `input_schema` is the JSON Schema of the caller's Zod schema — version-stable across SDK releases and the
 * idiomatic Claude way to get typed JSON. The SDK is lazy-imported so the stub path needs nothing installed
 * at runtime. We never log prompts, student answers, or image bytes (CLAUDE.md §6) — identifiers + outcomes only.
 *
 * Notes for current models (Sonnet 5 / Opus 4.8): `temperature`/`top_p`/`top_k` are rejected (400) — we send
 * none and steer via the prompt. Sonnet 5 runs **adaptive thinking by default** when `thinking` is omitted;
 * thinking tokens count against `max_tokens`, so an omitted field can silently eat the chat/vision budget and
 * truncate replies — we disable it explicitly (short, simple structured tasks; latency matters for kids).
 * Homework vision uses a stronger `visionModel`.
 */
export class AnthropicLlmProvider implements LlmProvider {
  readonly name = 'anthropic';
  readonly live = true;
  private readonly logger = new Logger('AnthropicLlmProvider');
  private clientPromise: Promise<any> | null = null;

  constructor(
    private readonly opts: {
      apiKey: string;
      model: string;
      visionModel: string;
      /** Optional per-call usage tap (token counts only) — used by the cutover smoke script. */
      onUsage?: (u: LlmUsage) => void;
    },
  ) {}

  private client(): Promise<any> {
    return (this.clientPromise ??= (async () => {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      return new Anthropic({ apiKey: this.opts.apiKey });
    })());
  }

  /**
   * System prompt as a prompt-cacheable text block. Caching only kicks in above the model's minimum prefix
   * (~2048–4096 tokens): the generation call qualifies (its huge tool schema counts toward the prefix), but
   * the short chat/vision prompts are below the minimum and the marker is a harmless no-op there.
   */
  private systemBlocks(system?: string): unknown[] | undefined {
    if (!system) return undefined;
    return [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }];
  }


  /**
   * Cost visibility on a free app: token counts per call (input/output/cache) so spend per day is readable
   * from logs before and after cutover. Counts + identifiers only — never prompt or reply content (§6).
   */
  private logUsage(op: 'chat' | 'extract', model: string, res: unknown): void {
    const u = (res as { usage?: Record<string, number | null> })?.usage;
    if (!u) return;
    const usage: LlmUsage = {
      op,
      model,
      inputTokens: u.input_tokens ?? 0,
      outputTokens: u.output_tokens ?? 0,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
      cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    };
    this.logger.log({ event: 'llm.usage', ...usage }, 'anthropic usage');
    this.opts.onUsage?.(usage);
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
        thinking: { type: 'disabled' },
        ...(req.system ? { system: this.systemBlocks(req.system) } : {}),
        messages: req.messages.map((m) => ({ role: m.role, content: m.text })),
      });
      this.logUsage('chat', this.opts.model, res);
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
        thinking: { type: 'disabled' },
        ...(req.system ? { system: this.systemBlocks(req.system) } : {}),
        // NOT strict: strict tool mode rejects several keywords this contract needs (maxItems from
        // z.array().length, oneOf from the discriminated union, tuple `items`) and hard-caps
        // union-typed parameters at 16 — the 14-type Exercise union alone has ~28. The schema still
        // steers generation as guidance; correctness is enforced AFTER the call, where LlmService
        // re-parses against the full Zod schema (incl. solvability) with one corrective re-ask.
        tools: [
          {
            name: req.schemaName,
            description: `Return a single ${req.schemaName} object.`,
            input_schema: req.jsonSchema,
          },
        ],
        tool_choice: { type: 'tool', name: req.schemaName },
        messages,
      });
      this.logUsage('extract', req.image ? this.opts.visionModel : this.opts.model, res);
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
