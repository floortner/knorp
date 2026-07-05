import { type Page, expect, request } from '@playwright/test';
import { API_BASE, REVIEWER_URL } from '../test-env';

export const E2E_PARENT_EMAIL = 'e2e-parent@example.test';

/**
 * Read the login code the `capture` email provider stored for `email` (test-only backend route). The
 * UI's request-code call and this read race slightly, so retry briefly.
 */
export async function fetchLoginCode(email: string): Promise<string> {
  const ctx = await request.newContext();
  try {
    for (let i = 0; i < 20; i++) {
      const res = await ctx.get(`${API_BASE}/test/last-login-code`, { params: { email } });
      if (res.ok()) return ((await res.json()) as { code: string }).code;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`No captured login code for ${email} — is the backend running with EMAIL_PROVIDER=capture?`);
  } finally {
    await ctx.dispose();
  }
}

/** Drive the passwordless family login UI end to end. Leaves the browser on /onboarding or /app/lernen. */
export async function loginAsFamily(page: Page, email = E2E_PARENT_EMAIL): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByRole('button', { name: 'Code per E-Mail senden' }).click();
  await page.getByRole('button', { name: 'Ich habe einen Code' }).click();
  await expect(page).toHaveURL(/\/login\/code$/);

  const code = await fetchLoginCode(email);
  const digits = page.getByLabel(/^Ziffer /);
  for (let i = 0; i < code.length; i++) await digits.nth(i).fill(code[i]);
  await page.getByRole('button', { name: 'Anmelden' }).click();
}

export const E2E_REVIEWER_EMAIL = 'e2e-reviewer@example.test';

/** Drive the staff (reviewer portal) passwordless login end to end. Leaves the browser on /queue. */
export async function loginAsStaff(page: Page, email = E2E_REVIEWER_EMAIL): Promise<void> {
  await page.goto(`${REVIEWER_URL}/login`);
  await page.getByLabel('Dienstliche E-Mail').fill(email);
  await page.getByRole('button', { name: 'Code anfordern' }).click();
  await expect(page).toHaveURL(/\/login\/code$/);
  const code = await fetchLoginCode(email);
  await page.getByLabel('6-stelliger Code').fill(code);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/queue$/);
}
