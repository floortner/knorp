import { z } from 'zod';

/**
 * Zod-validated environment (ARCHITECTURE §8). The app fails fast at boot if a required var is
 * missing or malformed. Milestone-1 requires NODE_ENV, PORT, DATABASE_URL, JWT_SECRET,
 * EMAIL_PROVIDER; the rest default to empty until their milestone.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8),
  // Staff realm (ARCHITECTURE §1a) — a DISTINCT signing key from JWT_SECRET so a credential in one realm
  // is never valid in the other. Required: the two realms must never share a key.
  STAFF_JWT_SECRET: z.string().min(8),
  // Dedicated HMAC key for the filesystem-store homework-image capability tokens (dev/no-S3 only; prod
  // uses S3 presigned URLs, so this path is never hit there). Optional — falls back to STAFF_JWT_SECRET
  // when unset — so setting it just removes the cross-purpose key reuse (security review P3). Min 8.
  IMAGE_TOKEN_SECRET: z.string().min(8).optional(),
  // CORS allowlist (credentials on), comma-separated. In production at least one origin MUST be set —
  // main.ts refuses to boot with a wide-open credentialed CORS (ARCHITECTURE §4). Empty → permissive
  // (dev/test only).
  WEB_ORIGIN: z.string().default(''),
  // Trainer-Portal origin for CORS (credentials on). Empty → permissive (dev/test only).
  TRAINER_ORIGIN: z.string().default(''),
  // Bind address override for main.ts. Empty → 127.0.0.1 in production (nginx-only), else 0.0.0.0.
  HOST: z.string().default(''),
  // Build stamp surfaced by /health (deploy sets it — ARCHITECTURE §7). Empty → 'dev'.
  GIT_COMMIT: z.string().default(''),
  // Public base URL of this API incl. the /api/v1 prefix. Used to build capability URLs the browser loads
  // directly — e.g. serving homework images from the filesystem store (no S3). Empty →
  // http://localhost:${PORT}/api/v1 (dev default).
  PUBLIC_API_URL: z.string().default(''),
  // Admin bootstrap (ARCHITECTURE §1b): comma-separated emails upserted as active admin trainers by the
  // seed (no staff self-signup). Empty in dev; set to the owner's email so someone can approve families.
  STAFF_ADMIN_EMAILS: z.string().default(''),
  // Homework review queue soft-lock lease, seconds (SPEC §6). Default 15 min.
  HOMEWORK_REVIEW_CLAIM_TTL: z.coerce.number().int().positive().default(900),
  EMAIL_PROVIDER: z.string().default('console'),
  EMAIL_KEY: z.string().default(''),
  // Sender identity for real email providers (e.g. "besserlesenschreiben <login@blesen.app>").
  // Required when EMAIL_PROVIDER is not 'console'.
  EMAIL_FROM: z.string().default(''),
  // Local dev convenience accounts (seed.ts). Seeded ACTIVE so you can log straight into the family app /
  // trainer portal without the pending→staff-approval flow. Login stays passwordless — request a code,
  // read it from the backend console. Requires BOTH an explicit SEED_DEV_ACCOUNTS=true opt-in AND
  // NODE_ENV != production, so a stray DEV_* var (e.g. a copied .env) can never seed a backdoor account.
  SEED_DEV_ACCOUNTS: z.string().default(''),
  DEV_FAMILY_EMAIL: z.string().default(''),
  DEV_TRAINER_EMAIL: z.string().default(''),
  // later milestones (optional for now)
  ANTHROPIC_API_KEY: z.string().default(''),
  // Default generation/chat model. Sonnet 5 = the best speed/intelligence balance for structured tasks
  // at a fraction of Opus pricing — the right default for a free app. Note its tokenizer counts ~30%
  // more tokens for the same text than Sonnet 4.6 (per-token price unchanged — watch the budget logs).
  // (temperature/top_p/top_k are rejected on current models; steer via the prompt instead.)
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5'),
  // Homework vision uses a stronger model — student handwriting OCR is accuracy-critical and the draft is
  // the trainer's starting point.
  ANTHROPIC_VISION_MODEL: z.string().default('claude-opus-4-8'),
  // EU data-residency / DPA acknowledgement for Anthropic-direct. Required in production before any LLM
  // call goes out (ARCHITECTURE §8): the app refuses to start with a key set but this unacknowledged.
  LLM_RESIDENCY_ACK: z.string().default(''),
  // Inference-routing region (`inference_geo` on every Anthropic call). Blank (default) omits the
  // parameter. The allowed values are an ORG capability, not a model one — 'eu' requires EU inference
  // routing enabled on the Anthropic org (ours allows only global/us as of 2026-08-09; a hardcoded
  // 'eu' 400'd every LLM call). Set to 'eu' the day the org supports it; usage.inference_geo is
  // logged per call as the audit trail either way.
  INFERENCE_GEO: z.enum(['eu', 'us', 'global']).or(z.literal('')).default(''),
  // Per-profile daily caps on cost-bearing ★ ops (the app is free — approval gates WHO, these gate HOW
  // MUCH). Counted from existing rows (session/chat_message) per app day (Europe/Berlin,
  // startOfAppDay). Over cap → friendly 429.
  LLM_SESSIONS_PER_DAY: z.coerce.number().int().positive().default(5),
  CHAT_MESSAGES_PER_DAY: z.coerce.number().int().positive().default(60),
  // Object storage: set AWS_S3_BUCKET to use S3 (auth via the default AWS credential chain — an IAM role
  // in prod, no keys in env); leave blank to use the local-filesystem store.
  AWS_S3_BUCKET: z.string().default(''),
  AWS_REGION: z.string().default('eu-central-1'),
  // Dev-only: where the local-filesystem store writes per-user files. Empty → defaults to
  // <os tmpdir>/blsb-dev-blob. Never used when AWS_S3_BUCKET is set.
  STORAGE_LOCAL_DIR: z.string().default(''),
});
// (TTS_* and BILLING_* vars removed: Polly authenticates via the IAM role — no key — and billing is
// deferred; both come back by ordinary schema addition if/when their milestones land.)

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  // The family and staff realms MUST NOT share a signing key (ARCHITECTURE §1a). The family guard
  // verifies by secret only, so an identical key would let a staff token authenticate as a family
  // account. Enforce the separation at boot rather than trusting operator discipline.
  if (parsed.data.STAFF_JWT_SECRET === parsed.data.JWT_SECRET) {
    throw new Error('Invalid environment variables:\n  - STAFF_JWT_SECRET: must differ from JWT_SECRET (realm isolation)');
  }
  return parsed.data;
}
