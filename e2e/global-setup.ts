import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backendEnv } from './test-env';

const here = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(here, '../besserlesenschreiben/backend');

/**
 * Prepare the test database before the suite runs. The DB itself must already exist (CI: the postgres
 * service creates `blsb_e2e`; locally: `createdb blsb_e2e` once). All three steps are idempotent.
 */
export default function globalSetup(): void {
  const env = { ...process.env, ...backendEnv };
  const run = (cmd: string, extraEnv: Record<string, string> = {}) =>
    execSync(cmd, { cwd: BACKEND, env: { ...env, ...extraEnv }, stdio: 'inherit' });
  run('npx prisma migrate deploy'); // schema
  run('npm run seed'); // staff admins + dev accounts (content seeding dropped 2026-07-13, ROADMAP §F)
  // Deterministic content-library fixture (ROADMAP §I2) — its own CONTENT_DIR so the linguists'
  // real content/ never influences the suite. Idempotent like the other steps.
  run('npm run content:import', { CONTENT_DIR: resolve(here, 'fixtures/content') });
  run('npm run seed:e2e'); // active family account + trainer fixtures
}
