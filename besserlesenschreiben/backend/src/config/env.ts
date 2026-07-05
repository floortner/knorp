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
  // CORS allowlist (credentials on), comma-separated. In production at least one origin MUST be set —
  // main.ts refuses to boot with a wide-open credentialed CORS (ARCHITECTURE §4). Empty → permissive
  // (dev/test only).
  WEB_ORIGIN: z.string().default(''),
  // Staff portal origin for CORS (credentials on). Empty → permissive (dev/test only).
  REVIEWER_ORIGIN: z.string().default(''),
  // Public base URL of this API incl. the /api/v1 prefix. Used to build capability URLs the browser loads
  // directly — e.g. serving homework images from the filesystem store (no S3). Empty →
  // http://localhost:${PORT}/api/v1 (dev default).
  PUBLIC_API_URL: z.string().default(''),
  // Admin bootstrap (ARCHITECTURE §1b): comma-separated emails upserted as active admin reviewers by the
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
  // reviewer portal without the pending→staff-approval flow. Login stays passwordless — request a code,
  // read it from the backend console. Requires BOTH an explicit SEED_DEV_ACCOUNTS=true opt-in AND
  // NODE_ENV != production, so a stray DEV_* var (e.g. a copied .env) can never seed a backdoor account.
  SEED_DEV_ACCOUNTS: z.string().default(''),
  DEV_FAMILY_EMAIL: z.string().default(''),
  DEV_REVIEWER_EMAIL: z.string().default(''),
  // later milestones (optional for now)
  ANTHROPIC_API_KEY: z.string().default(''),
  // Default generation/chat model. Sonnet 4.6 = the best speed/intelligence balance for structured tasks
  // at a fraction of Opus pricing — the right default for a free app. (temperature/top_p/top_k are rejected
  // on current models; steer via the prompt + output effort instead.)
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
  // Homework vision uses a stronger model — child handwriting OCR is accuracy-critical and the draft is
  // the reviewer's starting point.
  ANTHROPIC_VISION_MODEL: z.string().default('claude-opus-4-8'),
  // EU data-residency / DPA acknowledgement for Anthropic-direct. Required in production before any LLM
  // call goes out (ARCHITECTURE §8): the app refuses to start with a key set but this unacknowledged.
  LLM_RESIDENCY_ACK: z.string().default(''),
  // Per-profile daily caps on cost-bearing ★ ops (the app is free — approval gates WHO, these gate HOW
  // MUCH). Counted from existing rows (session/chat_message), UTC day. Over cap → friendly 429.
  LLM_SESSIONS_PER_DAY: z.coerce.number().int().positive().default(5),
  CHAT_MESSAGES_PER_DAY: z.coerce.number().int().positive().default(60),
  // Object storage: set AWS_S3_BUCKET to use S3 (auth via the default AWS credential chain — an IAM role
  // in prod, no keys in env); leave blank to use the local-filesystem store.
  AWS_S3_BUCKET: z.string().default(''),
  AWS_REGION: z.string().default('eu-central-1'),
  // Dev-only: where the local-filesystem store writes per-user files. Empty → defaults to
  // <os tmpdir>/blsb-dev-blob. Never used when AWS_S3_BUCKET is set.
  STORAGE_LOCAL_DIR: z.string().default(''),
  TTS_PROVIDER: z.string().default(''),
  TTS_KEY: z.string().default(''),
  BILLING_PROVIDER: z.string().default('lemonsqueezy'),
  BILLING_WEBHOOK_SECRET: z.string().default(''),
});

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
