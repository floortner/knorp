/**
 * scripts/seed-e2e.ts — E2E test fixtures (idempotent). NEVER run against a real database.
 *
 *   npm run seed:e2e   (needs DATABASE_URL; item-bank comes from `npm run seed` separately)
 *
 * Creates the identities the Playwright suite logs in as:
 *   - one ACTIVE family account PER browser project (accounts start `pending`; only `active` ones get
 *     login codes) — the two projects (chromium/webkit) run fullyParallel against the same backend, so
 *     a shared account would race on profile state + the last-code-wins capture. Per-project accounts
 *     isolate them. Keep this list in sync with the `projects` in e2e/playwright.config.ts.
 *   - a generic e2e-parent (helper default) and an ACTIVE reviewer (staff realm; admin-provisioned).
 *
 * Each family account's child profiles (and their cascade) are wiped each run so the
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
];
export const E2E_REVIEWER_EMAIL = 'e2e-reviewer@example.test';

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

    await prisma.reviewer.upsert({
      where: { email: E2E_REVIEWER_EMAIL },
      update: { status: 'active', role: 'reviewer', name: 'E2E Reviewer' },
      create: { email: E2E_REVIEWER_EMAIL, status: 'active', role: 'reviewer', name: 'E2E Reviewer' },
    });

    console.log(`[seed-e2e] ready: ${E2E_PARENT_EMAILS.length} parent accounts, ${E2E_REVIEWER_EMAIL} (reviewer)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
