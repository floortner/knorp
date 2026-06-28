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
  EMAIL_PROVIDER: z.string().default('console'),
  EMAIL_KEY: z.string().default(''),
  // Sender identity for real email providers (e.g. "besserlesenschreiben <login@blesen.app>").
  // Required when EMAIL_PROVIDER is not 'console'.
  EMAIL_FROM: z.string().default(''),
  // later milestones (optional for now)
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
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
  return parsed.data;
}
