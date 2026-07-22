# E2E tests (Playwright)

End-to-end tests for the **family frontend + backend**, run identically locally and in GitHub CI.

## What makes these cheap & deterministic
- The backend runs offline: `ANTHROPIC_API_KEY=''` → `StubLlmProvider`, `STORAGE_LOCAL_DIR` → local
  disk, `EMAIL_PROVIDER=capture` → login codes held in memory (read back via a gated test route).
- The anchor journey uses a **bank session** (zero LLM calls) → fully deterministic.
- Lower layers (contract drift gates, golden snapshots, unit specs) already cover shape + logic, so
  these are a thin layer of real user journeys.

Everything runs on `localhost` (frontend :5273 → backend :3100 — dedicated ports so an E2E run never
collides with a running `dev.sh`). Same-*site*, so the httpOnly session cookie flows normally.

## Run locally
Prerequisites: a running local Postgres and a one-time test database.

```bash
createdb blsb_e2e                 # once; or set DATABASE_URL to any empty DB
cd e2e
npm install
npx playwright install --with-deps chromium webkit   # once
npm test                          # boots backend + frontend, seeds, runs the suite
npm run test:ui                   # debug interactively
```

Override the DB with `DATABASE_URL=... npm test`. `global-setup.ts` runs `prisma migrate deploy`,
`npm run seed` (item bank), and `npm run seed:e2e` (an active family account + a reviewer) before tests.

## CI
This suite is **local-only** — it is intentionally **not** run in CI. `.github/workflows/ci.yml` runs the
fast backend/frontend/reviewer unit + golden + contract jobs; run the Playwright suite yourself
(`cd e2e && npm test`) before pushing anything that touches a real user journey.

## Adding specs
- Login helper: `helpers/auth.ts` (`loginAsFamily`).
- Follow-ons (harness already supports them): the homework-upload chat flow; reviewer smoke
  (staff realm on :5274 — add a third `webServer`); LLM chat/lesson against the stub.
