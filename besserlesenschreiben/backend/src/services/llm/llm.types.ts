/**
 * LLM abstraction (ARCHITECTURE §8). A single swappable provider so the backend can move from
 * Anthropic-direct (dev/default) to Azure AI Foundry / Vertex EU without touching callers. Free —
 * there is no credit/entitlement hook (ARCHITECTURE §9 deferred).
 */

export interface LlmMessage {
  role: 'user' | 'assistant';
  text: string;
}

/** A homework photo (or similar) passed to a vision-capable extract call. */
export interface LlmImage {
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp';
  /** base64-encoded bytes (no data: prefix). */
  dataBase64: string;
}

export interface ChatRequest {
  system?: string;
  messages: LlmMessage[];
  maxTokens?: number;
}

export interface ExtractRequest {
  system?: string;
  messages: LlmMessage[];
  image?: LlmImage;
  maxTokens?: number;
}

/** What a provider receives for a structured-output call (the service derives jsonSchema from Zod). */
export interface ProviderExtractRequest extends ExtractRequest {
  schemaName: string;
  jsonSchema: Record<string, unknown>;
}

/**
 * A swappable LLM backend. Providers never import the contract Zod schemas — `extractRaw` returns the
 * raw object the model produced; `LlmService` validates it against the caller's Zod schema.
 */
export interface LlmProvider {
  readonly name: string;
  /** True when the provider can actually reach a model (a real key/endpoint), false for the stub. */
  readonly live: boolean;
  chat(req: ChatRequest): Promise<string>;
  extractRaw(req: ProviderExtractRequest): Promise<unknown>;
}

/** DI token for the selected provider (wired in LlmModule from config). */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
