# E2E tests (Playwright)

End-to-end tests over the **family app, the trainer portal and the backend** — run locally before pushing
anything that touches a real user journey (deliberately not part of CI, see below).

## What makes these cheap & deterministic
- The backend runs offline: `ANTHROPIC_API_KEY=''` → `StubLlmProvider`, `STORAGE_LOCAL_DIR` → local
  disk, `EMAIL_PROVIDER=capture` → login codes held in memory (read back via a gated test route).
- The anchor journey uses a **bank session** (zero LLM calls) → fully deterministic.
- Lower layers (contract drift gates, golden snapshots, unit specs) already cover shape + logic, so
  these are a thin layer of real user journeys.

Everything runs on `localhost` (family :5273, trainer :5274 → backend :3100 — dedicated ports so an E2E run
never collides with a running `dev.sh`). Same-*site*, so the httpOnly session cookies flow normally.

## Run locally
Prerequisites: a running local Postgres and a one-time test database.

```bash
createdb blsb_e2e                 # once; or set DATABASE_URL to any empty DB
cd e2e
npm install
npx playwright install --with-deps chromium webkit   # once
npm test                          # boots backend + both frontends, seeds, runs the suite
npm run test:ui                   # debug interactively
```

Override the DB with `DATABASE_URL=... npm test`. `global-setup.ts` runs `prisma migrate deploy`,
`npm run seed` (staff admins + dev accounts), `npm run content:import` against the suite's own
`fixtures/content/` (so the real `content/` library never influences a run), and `npm run seed:e2e`
(an active family account + a trainer) before tests.

## CI
This suite is **local-only** — it is intentionally **not** run in CI. `.github/workflows/ci.yml` runs the
fast backend/frontend/trainer unit + golden + contract jobs; run the Playwright suite yourself
(`cd e2e && npm test`) before pushing anything that touches a real user journey.

## Specs
- `family.spec.ts` — login → onboarding → bank lesson → one `/attempts` emit. **`test.fixme` until §F
  ships seeded content** (the bank is empty pre-§F, so no „üben" entry renders).
- `homework-loop.spec.ts` — chat upload → trainer approves → verdict lands in the family chat.
- `assignment-loop.spec.ts` — imported lecture → trainer assigns → student completes → trainer sees it.
- The two cross-realm journeys run on chromium only; login helper: `helpers/auth.ts`.
