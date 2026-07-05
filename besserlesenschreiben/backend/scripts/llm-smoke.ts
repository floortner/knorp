/**
 * LLM cutover smoke — probes the REAL Anthropic pipeline exactly as the app uses it, with synthetic
 * content only (never child data). No Nest boot, no database: the provider + LlmService are plain classes.
 *
 *   npm run llm:smoke             # chat probe + double generation probe (cache assert)
 *   npm run llm:smoke -- --vision # additionally probe homework vision (Opus call — costs more)
 *
 * Requires ANTHROPIC_API_KEY in the environment / backend/.env. Exits 1 with the reason on any failure.
 * See backend/README.md § "LLM cutover" for the full runbook.
 */
import 'dotenv/config';
import { createLlmProvider } from '../src/services/llm/llm.module';
import type { LlmUsage } from '../src/services/llm/anthropic.provider';
import { LlmService } from '../src/services/llm/llm.service';
import { generatedSessionSchema, LLM_SYSTEM } from '../src/modules/sessions/sessions.service';
import { VISION_SYSTEM } from '../src/modules/homework/homework.service';
import { homeworkAnalysisSchema } from '../src/contract/staff';

// Rough list prices per MTok for the cost estimate (update if pricing changes).
const PRICE: Record<string, { in: number; out: number }> = {
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-opus-4-8': { in: 5, out: 25 },
};

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const usages: LlmUsage[] = [];
  const provider = createLlmProvider({
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    visionModel: process.env.ANTHROPIC_VISION_MODEL || 'claude-opus-4-8',
    isProd: false, // the smoke is a dev tool; prod boot enforces LLM_RESIDENCY_ACK separately
    residencyAck: true,
    onUsage: (u) => usages.push(u),
  });
  if (!provider.live) {
    fail('No ANTHROPIC_API_KEY set — the stub provider was selected. Set the key in backend/.env and retry.');
  }
  const llm = new LlmService(provider);

  // ── 1. Chat probe (Angelika persona, same maxTokens as ChatService) ────────
  console.log('\n── Chat probe ──');
  const chatSystem = [
    'Du bist Angelika, eine warmherzige Lese- und Schreibtrainerin für Kinder im Grundschulalter.',
    'Antworte immer auf Deutsch, kurz (1–3 Sätze), einfach, geduldig und ermutigend.',
  ].join(' ');
  const reply = await llm.chat({
    system: chatSystem,
    messages: [{ role: 'user', text: 'Warum hat jede Silbe einen Selbstlaut?' }],
    maxTokens: 400,
  });
  if (!reply.trim()) fail('chat returned an empty reply');
  console.log(`reply: ${reply}`);

  // ── 2. Generation probe ×2 (the critical path; byte-identical → 2nd must hit the cache) ──
  const genRequest = {
    system: LLM_SYSTEM,
    messages: [
      {
        role: 'user' as const,
        text: 'Klassenstufe: Mitte (zweite Klasse, mittlere Wörter)\nFörderschwerpunkte: vowel_length, vowel_substitution\n\nLernstand:\n(kein Lernstand — Probelauf)',
      },
    ],
  };
  for (const attempt of [1, 2]) {
    console.log(`\n── Generation probe ${attempt}/2 ──`);
    // extract() itself hard-asserts the contract: schema + solvability, with one corrective re-ask.
    const lecture = await llm.extract(generatedSessionSchema, 'generated_session', genRequest);
    console.log(`intro: ${lecture.intro}`);
    for (const ex of lecture.exercises) {
      console.log(`  [${ex.type}] ${JSON.stringify({ ...ex, id: undefined, audioUrl: undefined, praise: undefined })}`);
    }
  }
  const genUsages = usages.filter((u) => u.op === 'extract');
  const second = genUsages.at(-1);
  if (!second || second.cacheReadTokens <= 0) {
    fail(
      `prompt cache MISS on the 2nd generation call (cacheReadTokens=${second?.cacheReadTokens ?? 'n/a'}) — ` +
        'the system+tools prefix should be cached; check the cache_control marker and byte-stability of LLM_SYSTEM.',
    );
  }
  console.log(`\n✓ prompt cache hit on 2nd generation (cacheReadTokens=${second.cacheReadTokens})`);

  // ── 3. Vision probe (opt-in; Opus call) ────────────────────────────────────
  if (process.argv.includes('--vision')) {
    console.log('\n── Vision probe ──');
    const { default: sharp } = await import('sharp');
    // A synthetic "homework sheet": three words, one misspelled — no real child content.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300">
      <rect width="100%" height="100%" fill="white"/>
      <text x="40" y="80"  font-size="36" font-family="sans-serif">1. die Hand</text>
      <text x="40" y="150" font-size="36" font-family="sans-serif">2. der Hund</text>
      <text x="40" y="220" font-size="36" font-family="sans-serif">3. das Fewer</text>
    </svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const analysis = await llm.extract(homeworkAnalysisSchema, 'homework_analysis', {
      system: VISION_SYSTEM,
      messages: [{ role: 'user', text: 'Analysiere diese Hausübung.' }],
      image: { mediaType: 'image/png', dataBase64: png.toString('base64') },
    });
    console.log(`draft: ${JSON.stringify(analysis, null, 2)}`);
  }

  // ── Usage + cost summary ────────────────────────────────────────────────────
  console.log('\n── Usage summary ──');
  let totalEur = 0;
  for (const u of usages) {
    const p = PRICE[u.model] ?? PRICE['claude-sonnet-4-6'];
    // Cache reads bill at 10% of input; cache writes at 125%.
    const eur =
      ((u.inputTokens + 1.25 * u.cacheWriteTokens + 0.1 * u.cacheReadTokens) * p.in + u.outputTokens * p.out) / 1e6;
    totalEur += eur;
    console.log(
      `${u.op.padEnd(7)} ${u.model}  in=${u.inputTokens} out=${u.outputTokens} cacheR=${u.cacheReadTokens} cacheW=${u.cacheWriteTokens}  ≈ €${eur.toFixed(4)}`,
    );
  }
  console.log(`total ≈ €${totalEur.toFixed(4)} for this smoke run`);
  console.log('\n✓ LLM smoke passed');
}

main().catch((err) => {
  fail(`${(err as Error).message ?? err}`);
});
