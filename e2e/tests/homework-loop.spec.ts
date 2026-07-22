import { test, expect } from '@playwright/test';
import { loginAsFamily, loginAsStaff } from '../helpers/auth';

/**
 * The professional-in-the-loop journey ACROSS BOTH REALMS (ARCHITECTURE §11) — the seam no unit test
 * covers: family uploads homework in the Chat tab → the stub LLM drafts an analysis (pending_review) →
 * a staff reviewer approves it in the reviewer portal → the family chat shows the "geprüft" verdict.
 *
 * chromium-only: the flow spans two apps in one test and per-project accounts would double the queue;
 * one browser is enough to guard the seam. A per-spec family account avoids racing family.spec.ts.
 */
test.describe(() => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'cross-realm journey runs on chromium only');

  // 1×1 white PNG — enough for sharp to EXIF-strip + transcode to WebP.
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  test('homework: chat upload → reviewer approves → verdict lands in the family chat', async ({ page, context }) => {
    // ── Family: log in, ensure a profile, open the chat, upload a homework photo ──
    await loginAsFamily(page, 'e2e-homework-parent@example.test');
    await page.waitForURL(/\/(onboarding$|app\/lernen$)/);
    if (new URL(page.url()).pathname.endsWith('/onboarding')) {
      await page.getByRole('button', { name: 'Weiter' }).click();
      await page.getByLabel('Name').fill('Testschüler');
      await page.getByRole('button', { name: 'Weiter' }).click();
      await page.getByRole('button', { name: /Los geht/ }).click();
    }
    await expect(page).toHaveURL(/\/app\/lernen$/);

    await page.goto('/app/chat');
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: 'hausuebung.png', mimeType: 'image/png', buffer: PNG });

    // The photo appears as the student's chat bubble; the trainer confirms it arrived and that the
    // adapted exercises will follow (copy pinned in chat.service.spec.ts).
    await expect(page.getByRole('img', { name: 'Hausübung' })).toBeVisible();
    await expect(page.getByText(/Dein Foto ist da/).first()).toBeVisible();

    // ── Staff: second page in the same browser — a DISJOINT realm (staff cookie, other origin) ──
    const staff = await context.newPage();
    await loginAsStaff(staff);

    // The stub draft lands the upload in the open queue; open it and approve unchanged.
    await staff.getByText('Übungsblatt (Stub-Analyse)').first().click();
    await expect(staff).toHaveURL(/\/review\//);
    await staff.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(staff).toHaveURL(/\/queue$/); // verdict submitted → back on the queue
    await staff.close();

    // ── Family: the authoritative verdict is echoed into the chat history ──
    await page.reload();
    await expect(page.getByText(/geprüft/).first()).toBeVisible({ timeout: 15_000 });
  });
});
