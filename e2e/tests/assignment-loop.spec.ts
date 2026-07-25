import { test, expect } from '@playwright/test';
import { loginAsFamily, loginAsStaff } from '../helpers/auth';

/**
 * The teaching-console journey ACROSS BOTH REALMS (ROADMAP §H1) — the seam no unit test covers:
 * a trainer authors + publishes a lecture and assigns it to a student → the student sees the personal
 * "Übung von …" card on /lernen, plays the lecture (Merksatz intro → exercises) as a normal session →
 * completion marks the assignment → the trainer sees the outcome and the per-question drill-down.
 *
 * chromium-only: spans two apps in one test (same rationale as homework-loop.spec.ts).
 */
test.describe(() => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'cross-realm journey runs on chromium only');

  test('assignment: trainer authors → assigns → student completes → trainer sees the result', async ({ page, context }) => {
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

    // ── Staff: author, publish, assign (fresh lecture each run — seed-e2e wipes the trainer's lectures) ──
    const staff = await context.newPage();
    await loginAsStaff(staff, 'e2e-assignment-trainer@example.test');
    await staff.getByRole('link', { name: 'Lektionen' }).click();
    await staff.getByRole('button', { name: 'Neue Lektion' }).click();

    await staff.getByLabel('Titel').fill('Dehnungs-h entdecken');
    await staff.getByLabel(/Merksatz/).fill('Merke: Das stumme h macht den Selbstlaut davor lang.');
    await staff.getByLabel('Frage').fill('Welches Wort hat ein Dehnungs-h?');
    await staff.getByLabel(/Antwortmöglichkeiten/).fill('fahren\nfallen');
    await staff.getByLabel('Richtige Antwort').fill('fahren');
    await staff.getByRole('button', { name: 'Als Entwurf speichern' }).click();

    await expect(staff.getByText('Entwurf')).toBeVisible();
    await staff.getByRole('button', { name: 'Veröffentlichen' }).click();
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
    await expect(page.getByText('Dehnungs-h entdecken')).toBeVisible();
    await card.click();

    await expect(page).toHaveURL(/\/app\/lesson$/);
    // The trainer's Merksatz renders as the teaching intro card before the first exercise.
    await expect(page.getByText(/Das stumme h macht den Selbstlaut/)).toBeVisible();
    await page.getByRole('button', { name: /Los geht/ }).click();
    // Answer the single item correctly → session completes → assignment marked.
    await page.getByTestId('choice-tile').filter({ hasText: 'fahren' }).click();
    await expect(page.getByText('Geschafft!')).toBeVisible();

    // The completed assignment drops off /lernen (an offer, once).
    await page.goto('/app/lernen');
    await expect(page.getByRole('button', { name: /Übung von Angelika/ })).toHaveCount(0);

    // ── Staff: the outcome lands in the assignment table + per-question drill-down ──
    await staff.reload();
    await expect(staff.getByText('Erledigt', { exact: true }).nth(1)).toBeVisible();
    await expect(staff.getByText(/1\/1 Aufgaben · 100% richtig/)).toBeVisible();
    await staff.getByRole('link', { name: /Details/ }).click();
    await expect(staff).toHaveURL(/\/students\/.+\/sessions\//);
    await expect(staff.getByText('Welches Wort hat ein Dehnungs-h?')).toBeVisible();
    await expect(staff.getByText('fahren', { exact: true })).toBeVisible();
  });
});
