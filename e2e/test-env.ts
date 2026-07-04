import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Shared config for the E2E run — imported by both playwright.config.ts and global-setup.ts so the
 * servers, the fixture seed, and the tests all agree on ports/DB/secrets.
 *
 * Dedicated ports (not the dev 3000/5173) so an E2E run never collides with a running `dev.sh` and
 * never accidentally attaches to a console-email dev server (the capture provider is mandatory here).
 * localhost:5273 → localhost:3100 is still same-*site*, so the httpOnly session cookie flows normally.
 */
export const BACKEND_PORT = 3100;
export const FRONTEND_PORT = 5273;
export const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
export const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
export const API_BASE = `${BACKEND_URL}/api/v1`;

/** Test database. CI sets DATABASE_URL to the postgres service; locally, create this DB once. */
export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/blsb_e2e';

// The env validator rejects equal family/staff signing keys (realm isolation) — keep them distinct.
const JWT_SECRET = process.env.E2E_JWT_SECRET ?? 'e2e-family-signing-secret';
const STAFF_JWT_SECRET = process.env.E2E_STAFF_JWT_SECRET ?? 'e2e-staff-signing-secret';

/** Env for the backend server + the fixture seed. Deterministic + offline: */
export const backendEnv: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: String(BACKEND_PORT),
  DATABASE_URL,
  JWT_SECRET,
  STAFF_JWT_SECRET,
  EMAIL_PROVIDER: 'capture', // login codes captured in memory, read back via /test/last-login-code
  ANTHROPIC_API_KEY: '', // empty → StubLlmProvider (no paid calls, no network, deterministic)
  STORAGE_LOCAL_DIR: join(tmpdir(), 'blsb-e2e-storage'), // local-disk blob backend (no S3)
};

export const frontendEnv: Record<string, string> = {
  VITE_API_BASE: API_BASE,
};
