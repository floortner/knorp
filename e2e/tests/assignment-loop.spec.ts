import { test, expect } from '@playwright/test';
import { loginAsFamily, loginAsStaff } from '../helpers/auth';

/**
 * The teaching-console journey ACROSS BOTH REALMS (ROADMAP §H1/§I3) — the seam no unit test covers:
 * the content-library fixture lecture (imported by global-setup from e2e/fixtures/content/) appears
 * in the trainer portal → the trainer assigns it to a student → the student sees the personal
 * "Übung von …" card on /lernen, plays the lecture (Merksatz intro → exercises) as a normal session →
 * completion marks the assignment → the trainer sees the outcome and the per-question drill-down.
 *
 * chromium-only: spans two apps in one test (same rationale as homework-loop.spec.ts).
 */
test.describe(() => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'cross-realm journey runs on chromium only');

  test('assignment: imported lecture → trainer assigns → student completes → trainer sees the result', async ({ page, context }) => {
    // ── Family: log in, ensure a profile exists ──
    await loginAsFamily(page, 'e2e-assignment-parent@example.test');
    await page.waitForURL(/\/(onboarding$|app\/lernen$)/);
    if (new URL(page.url()).pathname.endsWith('/onboarding')) {
      await page.getByRole('button', { name: 'Weiter' }).click();
      await page.getByLabel('Name').fill('Zoe');
      await page.getByRole('button', { name: 'Weiter' }).click();
      await page.getByRole('button', { name: /Los geht/ }).click();
    }
    await expect(page).toHaveURL(/\/app\/lernen$/);

    // ── Staff: the imported fixture lecture is in the library; assign it (fresh each run — the
    //    profile wipe in seed-e2e cascades the previous run's assignment away) ──
    const staff = await context.newPage();
    await loginAsStaff(staff, 'e2e-assignment-trainer@example.test');
    await staff.getByRole('link', { name: 'Lektionen' }).click();
    await expect(staff.getByText(/kommen aus der Content-Bibliothek/)).toBeVisible();
    await staff.getByRole('link', { name: /E2E-Übungslektion/ }).click();

    await expect(staff.getByText(/aus der Content-Bibliothek/)).toBeVisible();
    await staff.getByRole('button', { name: 'Zuweisen' }).click();
    await staff.getByLabel(/Zoe/).check();
    await staff.getByRole('button', { name: /^Zuweisen \(1\)$/ }).click();
    await expect(staff.getByText(/1 zugewiesen/)).toBeVisible();
    await staff.getByRole('button', { name: 'Schließen' }).click();
    await expect(staff.getByText('Offen', { exact: true }).nth(1)).toBeVisible(); // status badge next to the chip

    // ── Family: the personal card appears; play the lecture through ──
    await page.goto('/app/lernen');
    const card = page.getByRole('button', { name: /Übung von Angelika/ });
    await expect(card).toBeVisible();
    await expect(page.getByText('E2E-Übungslektion')).toBeVisible();
    await card.click();

    await expect(page).toHaveURL(/\/app\/lesson$/);
    // The lecture's Merksatz renders as the teaching intro card before the first exercise.
    await expect(page.getByText(/Diese Lektion kommt aus der Content-Bibliothek/)).toBeVisible();
    await page.getByRole('button', { name: /Los geht/ }).click();
    // Answer both items correctly → session completes → assignment marked.
    await page.getByTestId('choice-tile').filter({ hasText: 'die richtige' }).click();
    await page.getByTestId('choice-tile').filter({ hasText: /^zweite$/ }).click();
    await expect(page.getByText('Geschafft!')).toBeVisible();

    // The completed assignment drops off /lernen (an offer, once).
    await page.goto('/app/lernen');
    await expect(page.getByRole('button', { name: /Übung von Angelika/ })).toHaveCount(0);

    // ── Staff: the outcome lands in the assignment table + per-question drill-down ──
    await staff.reload();
    await expect(staff.getByText('Erledigt', { exact: true }).nth(1)).toBeVisible();
    await expect(staff.getByText(/2\/2 Aufgaben · 100% richtig/)).toBeVisible();
    await staff.getByRole('link', { name: /Details/ }).click();
    await expect(staff).toHaveURL(/\/students\/.+\/sessions\//);
    await expect(staff.getByText('Welche Antwort ist die richtige?')).toBeVisible();
    await expect(staff.getByText('Und hier?')).toBeVisible();
  });
});
