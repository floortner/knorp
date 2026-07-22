import { test, expect } from '@playwright/test';
import { loginAsFamily } from '../helpers/auth';

/**
 * Anchor journey: family login → onboarding → a deterministic bank-session lesson → telemetry.
 *
 * Everything here is offline/deterministic: the LLM is stubbed (empty ANTHROPIC_API_KEY) and the
 * bank-session path makes zero LLM calls. Uses a PER-PROJECT account (the two browser projects run
 * fullyParallel against one backend, so a shared account would race on profile state + the last-code
 * capture). The onboarding step is conditional so a retry — which reuses the profile the first attempt
 * created — is safe.
 */
// FIXME(§F): the bank-lesson half cannot pass until the new content set exists — `npm run seed` stopped
// seeding the item bank when Vokaltraining was dropped (2026-07-13, ROADMAP §F), so /units is empty and
// no "üben" entry renders. Un-fixme when §F ships seeded content.
test.fixme('family: login → onboarding → bank lesson emits one /attempts', async ({ page }, testInfo) => {
  await loginAsFamily(page, `e2e-parent-${testInfo.project.name}@example.test`);

  // Post-login routing: /onboarding when the account has no profile (fresh run), else /app/lernen
  // (a prior attempt/retry already created one). Only run onboarding in the former case.
  await page.waitForURL(/\/(onboarding$|app\/lernen$)/);
  if (new URL(page.url()).pathname.endsWith('/onboarding')) {
    await page.getByRole('button', { name: 'Weiter' }).click(); // step 0 → 1
    await page.getByLabel('Name').fill('Testschüler');
    await page.getByRole('button', { name: 'Weiter' }).click(); // step 1 → 2
    await page.getByRole('button', { name: /Los geht/ }).click(); // create profile → /app/lernen
  }

  await expect(page).toHaveURL(/\/app\/lernen$/);
  await expect(page.getByText('Testschüler')).toBeVisible();

  // Start the current (unlocked) unit → a deterministic bank session, and land on the lesson.
  await page.getByRole('button', { name: /üben/i }).first().click();
  await expect(page).toHaveURL(/\/app\/lesson$/);
  await expect(page.getByText(/1 \/ \d+/)).toBeVisible(); // progress "1 / N"

  // Answer the first item. Any answer (right or wrong) emits exactly one POST /attempts with a real
  // timeMs — the product's telemetry spine (SPEC §4). choice-tile covers single/binary/pair renderers;
  // extend for raster/tile-order/sentence first items in a follow-on if the anchor ever draws one.
  const attempt = page.waitForRequest(
    (r) => r.method() === 'POST' && /\/api\/v1\/attempts$/.test(r.url()),
  );
  await page.getByTestId('choice-tile').first().click();

  const body = (await attempt).postDataJSON() as { timeMs: number; sessionId: string };
  expect(typeof body.timeMs).toBe('number');
  expect(body.timeMs).toBeGreaterThanOrEqual(0);
  expect(body.sessionId).toBeTruthy();
});
