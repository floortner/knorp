import { defineConfig, devices } from '@playwright/test';
import { BACKEND_URL, FRONTEND_PORT, FRONTEND_URL, REVIEWER_PORT, REVIEWER_URL, backendEnv, frontendEnv, reviewerEnv } from './test-env';

// Mobile-first app (~390px). Cover Chromium + WebKit (WebKit ≈ iOS Safari).
const viewport = { width: 390, height: 844 };

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    video: 'on-first-retry',
    viewport,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport } },
  ],
  // One command boots both servers for local and CI alike. Dedicated ports → no dev.sh collision, so
  // we always start our own capture-email servers rather than reuse an arbitrary one.
  webServer: [
    {
      command: 'npm run start:dev',
      cwd: '../besserlesenschreiben/backend',
      url: `${BACKEND_URL}/api/v1/health`,
      env: backendEnv,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
      cwd: '../besserlesenschreiben/frontend',
      url: FRONTEND_URL,
      env: frontendEnv,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --port ${REVIEWER_PORT} --strictPort`,
      cwd: '../besserlesenschreiben/reviewer',
      url: REVIEWER_URL,
      env: reviewerEnv,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
