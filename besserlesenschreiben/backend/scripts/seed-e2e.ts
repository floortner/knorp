/**
 * scripts/seed-e2e.ts — E2E test fixtures (idempotent). NEVER run against a real database.
 *
 *   npm run seed:e2e   (needs DATABASE_URL; exercise content arrives via `npm run content:import`, not the seed)
 *
 * Creates the identities the Playwright suite logs in as:
 *   - one ACTIVE family account PER browser project (accounts start `pending`; only `active` ones get
 *     login codes) — the two projects (chromium/webkit) run fullyParallel against the same backend, so
 *     a shared account would race on profile state + the last-code-wins capture. Per-project accounts
 *     isolate them. Keep this list in sync with the `projects` in e2e/playwright.config.ts.
 *   - a generic e2e-parent (helper default) and an ACTIVE trainer (staff realm; admin-provisioned).
 *
 * Each family account's student profiles (and their cascade) are wiped each run so the
 * login → onboarding → first-lesson journey starts from a deterministic zero-profile state.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

export const E2E_PARENT_EMAIL = 'e2e-parent@example.test';
// Per-project accounts: `e2e-parent-<project>@example.test`. The family spec derives its email from the
// running project name, so the two browser projects never touch the same account.
export const E2E_PARENT_EMAILS = [
  E2E_PARENT_EMAIL,
  'e2e-parent-chromium@example.test',
  'e2e-parent-webkit@example.test',
  'e2e-homework-parent@example.test', // cross-realm homework-loop spec (chromium-only)
  'e2e-assignment-parent@example.test', // cross-realm assignment-loop spec (chromium-only, §H1)
];
export const E2E_TRAINER_EMAIL = 'e2e-trainer@example.test';
// Per-spec trainer for the assignment-loop journey: the two cross-realm specs run fullyParallel and
// would otherwise race on one email's last-captured login code (same isolation as per-project parents).
export const E2E_ASSIGNMENT_TRAINER_EMAIL = 'e2e-assignment-trainer@example.test';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-e2e must never run with NODE_ENV=production.');
  }
  const adapter = new PrismaPg(process.env.DATABASE_URL as string);
  const prisma = new PrismaClient({ adapter });
  try {
    for (const email of E2E_PARENT_EMAILS) {
      const account = await prisma.account.upsert({
        where: { email },
        update: { status: 'active' },
        create: { email, status: 'active' },
      });
      // Reset to a clean zero-profile state (cascades to sessions/attempts/review_state/homework/chat).
      await prisma.profile.deleteMany({ where: { accountId: account.id } });
    }

    await prisma.trainer.upsert({
      where: { email: E2E_TRAINER_EMAIL },
      update: { status: 'active', role: 'trainer', name: 'E2E Trainer' },
      create: { email: E2E_TRAINER_EMAIL, status: 'active', role: 'trainer', name: 'E2E Trainer' },
    });
    await prisma.trainer.upsert({
      where: { email: E2E_ASSIGNMENT_TRAINER_EMAIL },
      update: { status: 'active', role: 'trainer', name: 'Angelika' },
      create: { email: E2E_ASSIGNMENT_TRAINER_EMAIL, status: 'active', role: 'trainer', name: 'Angelika' },
    });
    // Lectures come from the content-library import in global-setup (§I2) — no authored-lecture wipe
    // needed anymore: the profile wipe above cascades the previous run's assignments away, and the
    // fixture lecture itself is re-imported idempotently.

    // Sweep the e2e trainers' login codes: the 60s resend throttle is a durable DB row, but the
    // capture provider is per-boot in-memory — a suite re-run within a minute would otherwise get
    // "no captured code" (throttled re-send against a fresh, empty capture map).
    await prisma.staffLoginCode.deleteMany({
      where: { email: { in: [E2E_TRAINER_EMAIL, E2E_ASSIGNMENT_TRAINER_EMAIL] } },
    });

    console.log(`[seed-e2e] ready: ${E2E_PARENT_EMAILS.length} parent accounts, ${E2E_TRAINER_EMAIL} (trainer)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
