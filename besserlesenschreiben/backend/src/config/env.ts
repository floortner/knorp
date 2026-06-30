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
  // Staff portal origin for CORS (credentials on). Empty → CORS reflects any origin (dev default).
  REVIEWER_ORIGIN: z.string().default(''),
  // Homework review queue soft-lock lease, seconds (SPEC §6). Default 15 min.
  HOMEWORK_REVIEW_CLAIM_TTL: z.coerce.number().int().positive().default(900),
  EMAIL_PROVIDER: z.string().default('console'),
  EMAIL_KEY: z.string().default(''),
  // Sender identity for real email providers (e.g. "besserlesenschreiben <login@blesen.app>").
  // Required when EMAIL_PROVIDER is not 'console'.
  EMAIL_FROM: z.string().default(''),
  // later milestones (optional for now)
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
  // EU data-residency / DPA acknowledgement for Anthropic-direct. Required in production before any LLM
  // call goes out (ARCHITECTURE §8): the app refuses to start with a key set but this unacknowledged.
  LLM_RESIDENCY_ACK: z.string().default(''),
  AZURE_STORAGE_ACCOUNT: z.string().default(''),
  AZURE_STORAGE_CONTAINER: z.string().default(''),
  // Dev-only: where the local-filesystem Blob fake writes per-user files until the Azure adapter lands.
  // Empty → defaults to <os tmpdir>/blsb-dev-blob. Never used when AZURE_STORAGE_ACCOUNT is set.
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
