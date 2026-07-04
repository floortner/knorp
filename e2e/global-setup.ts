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
  const run = (cmd: string) => execSync(cmd, { cwd: BACKEND, env, stdio: 'inherit' });
  run('npx prisma migrate deploy'); // schema
  run('npm run seed'); // item bank (deterministic bank sessions)
  run('npm run seed:e2e'); // active family account + reviewer fixtures
}
