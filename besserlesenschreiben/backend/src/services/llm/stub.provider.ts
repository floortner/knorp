import { ApiException } from '../../common/exceptions/api-exception';
import type { ChatRequest, LlmProvider, ProviderExtractRequest } from './llm.types';

/**
 * Dev/test fallback used when no `ANTHROPIC_API_KEY` is set. `chat` returns a harmless canned reply so the
 * chat UI is exercisable offline; `extractRaw` (homework vision, session generation) can't fabricate a valid
 * structured result, so it fails loudly with 503 — those features simply need a real key in dev.
 */
export class StubLlmProvider implements LlmProvider {
  readonly name = 'stub';
  readonly live = false;

  async chat(req: ChatRequest): Promise<string> {
    const lastUser = [...req.messages].reverse().find((m) => m.role === 'user')?.text ?? '';
    return `(Stub-KI) Ich habe verstanden: „${lastUser.slice(0, 140)}". Setze ANTHROPIC_API_KEY für echte Antworten.`;
  }

  async extractRaw(_req: ProviderExtractRequest): Promise<unknown> {
    throw new ApiException(503, 'PROVIDER_UNAVAILABLE', 'KI-Funktion ist in dieser Umgebung nicht verfügbar.');
  }
}
