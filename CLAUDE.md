# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**besserlesenschreiben** — an adaptive German literacy tutor for students (ages 8-14). Sub-projects developed together but deployed independently:

- `besserlesenschreiben/backend/` — NestJS API (`-api` repo)
- `besserlesenschreiben/frontend/` — Vite/React SPA/PWA, the family app (`-web` repo)
- `besserlesenschreiben/reviewer/` — Vite/React internal **staff portal** for professional homework review (`-review` repo; ARCHITECTURE §1a/§11). Internal-only (~3 hand-provisioned staff), never shipped to families; **desktop/tablet landscape, not mobile-first**. Shipped: review queue + history, admin user administration, learner progress. (The "Wortschatz" lexeme-curation tab was dropped 2026-07-13 with the Vokaltraining content set — ROADMAP.md §F.)

Two disjoint **auth realms** (ARCHITECTURE §1a): the **family** realm (parents + students, `-web`) and the **staff** realm (internal reviewers, `-review`). A credential in one is never valid in the other — different cookie/`aud`, different guard (`JwtAuthGuard` vs `StaffAuthGuard`).

The seed script lives in the backend: `besserlesenschreiben/backend/prisma/seed.ts` (idempotent; bootstraps staff admins from `STAFF_ADMIN_EMAILS`, and — with `SEED_DEV_ACCOUNTS=true` — dev login accounts). Content seeding (the item bank + lexeme base ⊕ overrides, `npm run gen:items`) was dropped 2026-07-13 along with the Vokaltraining content set — see ROADMAP.md §F for the content-set redesign in progress. `item_bank.seed.json` is the curated source of truth for exercise content once it exists — there is no regeneration script (never rebuild it wholesale).

Currently one **monorepo** for fast cross-cutting iteration; the subprojects are independently buildable/deployable and split into the `-api`/`-web`/`-review` repos before launch (ARCHITECTURE §1).

## Read order before touching any code

1. **`<subproject>/AGENTS.md`** — the short, authoritative guide for the subproject you're working in (read this first)
2. **`besserlesenschreiben/ARCHITECTURE.md`** — governs both projects; wins over either SPEC on all cross-cutting concerns (API shape, errors, logging, versions, hosting, payments, media)
3. **`<subproject>/SPEC.md`** — the detailed spec for that project

## Commands

### Run locally (dev)
```bash
besserlesenschreiben/dev.sh all      # backend (:3000) + family (:5173) + reviewer (:5174), Ctrl-C stops all
besserlesenschreiben/dev.sh          # backend + family only  ·  api / web / review = one subproject at a time
```
Copies missing `.env` files from `.env.example` and installs deps on first run. It does **not** set up
Postgres — do the one-time DB setup in `besserlesenschreiben/backend/README.md` first.

### Backend (`besserlesenschreiben/backend/`)
```bash
npm ci                          # install
npm run start:dev               # dev server
npm test                        # Vitest (includes golden tests for digest.md + Exercise JSON)
npm test -- src/path/to/spec.ts # run a single test file
npm run lint                    # ESLint
npx tsc --noEmit                # typecheck
npm run openapi:export          # regenerate committed openapi.json after any contract (Zod) change
npx prisma migrate dev          # local DB migrations
npx prisma migrate deploy       # CI/prod migrations (run as pre-traffic step)
npx prisma generate             # regenerate Prisma client after schema changes
npm run seed                    # bootstrap staff admins + (with SEED_DEV_ACCOUNTS=true) dev accounts
```
Content seeding (`item_bank.seed.json`, the lexeme foundation, `gen:items`/`export:overrides`) was dropped
2026-07-13 along with the Vokaltraining content set — see ROADMAP.md §F.

### Frontend (`besserlesenschreiben/frontend/`)
```bash
npm install                     # install
npm run dev                     # dev server
npm run build                   # production build (vite build)
npm test                        # golden snapshot tests for Exercise rendering contract
npm test -- src/path/to/spec.ts # run a single test file
npm run gen:api                 # regenerate api.ts types from backend OpenAPI (openapi-typescript)
```

### Reviewer (`besserlesenschreiben/reviewer/`)
Same commands as the frontend (`npm install` · `npm run dev` on **:5174** · `build` · `test` · `gen:api`), typed from the backend's `/staff/*` OpenAPI. Internal staff portal — desktop/tablet, no PWA.

### End-to-end (`e2e/`, repo root — its own npm project)
```bash
createdb blsb_e2e                 # one-time test DB (or point DATABASE_URL at any empty DB)
cd e2e && npm install && npx playwright install --with-deps chromium webkit   # once
npm test                          # boots backend :3100 + family :5273, seeds, runs the Playwright suite
npm run test:ui                   # interactive debug
```
Real user journeys over family frontend + backend, deterministic and offline: `ANTHROPIC_API_KEY=''` → `StubLlmProvider`, `EMAIL_PROVIDER=capture` (login codes read back via a gated test route), local-disk storage, and the anchor journey uses a **bank session** (zero LLM calls). Dedicated ports so a run never collides with `dev.sh`. `global-setup.ts` runs `migrate deploy` + `npm run seed` (item bank) + `npm run seed:e2e` (an active family account + a reviewer). **Run locally only — the Playwright suite is intentionally not part of CI**; the fast backend/frontend/reviewer jobs (contract-drift gates, golden snapshots, unit specs) are the CI safety net, so this is a thin real-journey layer you run yourself before pushing.

**CI (`.github/workflows/ci.yml`):** per-project jobs run `lint · typecheck · test · build` plus the **contract-drift gates** — `npm run openapi:export` then `git diff --exit-code openapi.json` (backend), and `npm run gen:api` then `git diff --exit-code api.gen.ts` (frontend/reviewer). Regenerate and commit these whenever a Zod contract changes or CI fails red.

Other root dirs: `website/` — static marketing page; `assets/` — the master mascot/art source library +
`manifest.json` catalog (SVG masters versioned, large PNG renders gitignored; the app serves the SVG subset
from `besserlesenschreiben/frontend/monster-pets/`). (`data-foundation/` — the *Rechtschreibwortschatz* source
corpus + `parse-rwe.py` — was deleted 2026-07-13 along with the lexeme foundation, ROADMAP.md §F.)

## Architecture overview

### System topology
```
Frontend (Vite/React SPA/PWA)  ←→  Backend (NestJS/Fastify)
                                        │
                    ┌───────────────────┼──────────────────┐
                    ▼                   ▼                  ▼
            AWS RDS PostgreSQL  Amazon S3             Anthropic API
            (Prisma 7)          (per-user presigned)  (sessions/chat/vision)
```

The **API contract** (`backend/SPEC.md §6`) is the only boundary. The frontend holds no DB or business logic; the backend serves no HTML.

### Backend structure
- `src/contract/` — Zod schemas (`exercise.ts`, `models.ts`) that are the **source** of the contract pipeline: Zod → `openapi.json` → `api.gen.ts`. Edit here first, then re-export.
- `src/modules/` — one folder per resource: controller (HTTP only) + service + Zod DTOs
- `src/services/` — domain logic only, no HTTP concerns: `digest` (renders `digest.md` for LLM), `fsrs` (spaced-repetition scheduler), `storage` (S3 presigned URLs / local-FS dev store), `email`, `llm`. (`lexeme` was deleted 2026-07-13 with the content set, ROADMAP.md §F.)
- `src/common/guards/` — `JwtAuthGuard` (family; requires `status='active'`), `StaffAuthGuard` (staff realm)
- `src/common/filters/` — global exception filter → the one error envelope
- `prisma/schema.prisma` — the model truth; DDL in `backend/SPEC.md §3` is its conceptual form
- `prisma/seed.ts` — bootstraps staff admins + dev accounts (content seeding dropped 2026-07-13, §F)

### Frontend structure
- `docs/knorp.html` — **interactive design prototype**; visual source of truth for the shell, screens and brand. Its exercise interactions document a legacy type set — the current exercise types live in `frontend/SPEC.md §3`. Recreate looks in React/Tailwind/shadcn — do not copy the prototype's HTML or inline styles.
- `fixtures/` — committed golden JSON payloads (`session.example.json`, `units.example.json`). The Vokaltraining content set (14 exercise types, 7 units) was dropped 2026-07-13 (ROADMAP.md §F) — these currently hold a single stand-in `placeholder` exercise and an empty units array. Build renderers and snapshot tests against these.
- `src/lib/api.gen.ts` — types **generated** from backend OpenAPI (`npm run gen:api`), committed, never hand-edited
- `src/lib/api.ts` — typed fetch client, **transport only** (no JSX), built on `api.gen.ts` types
- `src/features/exercises/types.ts` — the `Exercise` discriminated union (currently a single `placeholder` stand-in type; training types are being redesigned from scratch, §F)
- `src/features/exercises/` — the exercise renderers + reusable scaffolding (`ExerciseCard`/`ChoiceTile`/`useAnswer`/`SingleChoiceExercise`). The Vokaltraining-specific renderers (Wortraster, tile order, sentence) were deleted with their types.
- `src/features/exercises/audio.ts` — `audioUrl` playback + Web Speech API fallback
- `src/lib/telemetry.ts` — attempt timing + fire-and-forget emit

`features/exercises/types.ts` and `lib/api.ts` **must stay in lockstep with the backend contract**. A change to either is a contract change — re-export `openapi.json`, regenerate `api.gen.ts` via `npm run gen:api`, and update golden tests.

### Session generation (two paths)
- **Bank session (default, free):** deterministic — queries `attempt` table for weak/due skills via FSRS (`ts-fsrs`), selects from `item_bank`. Zero LLM calls.
- **LLM session (★ gated):** lectures generated on the fly — loads `digest.md` (derived from answers, **response times** `time_ms`, and **retries** `attempt_no`) plus any **professionally-reviewed** homework focus → prompts Claude → validates against Zod schemas → inserts into `item_bank` (`generated_by='llm'`) → returns session.

The database decides *what* to drill — informed by telemetry **and the staff-validated homework focus**; the LLM only generates *new content and conversation*.

### Homework review (professional-in-the-loop)
Homework photos are uploaded by the family but validated by an **internal staff reviewer**, not the parent (ARCHITECTURE §11, backend SPEC §10). Vision produces a **draft** (`homework_upload.llm_analysis`) that is **never applied on its own**; a reviewer approves/corrects/rejects in the staff portal, and only the **authoritative** `reviewed_analysis` mutates `attempt`/`review_state` and feeds the next lecture. Review is **async** (the student is never blocked) and the queue is **pseudonymised** (image + draft + skill tags + grade band only). The old `POST /homework/{id}/confirm` parent step is **removed**.

### Build status & roadmap
The single source of truth for what's shipped and what's next is the repo-root **`ROADMAP.md`**. In short:
everything through Phase 2.5 + Post-2.5, plus the **AWS beta deployment (E)**, is **done** — the app is live
on real HTTPS domains. The Vokaltraining content set (word lists, 14 exercise types, 7-unit sequence, lecture
prompt) was **dropped 2026-07-13**; **next** is **F** — redesigning that content layer from scratch — **then**
D5/D6 (badges, weekly parent email). **Product decision — the app is FREE, including the AI features; access
is gated by staff approval, not payment (ARCHITECTURE §1b/§9).** Billing is **deferred** and not built: no
`EntitlementGuard`, credits, or `402` gating; the `entitlement`/`credits_ledger` tables stay dormant so
metering stays a future option, and `★` means "AI-backed / cost-bearing op," free for any approved active
account. TTS is deferred (Web-Speech fallback for now; target Amazon Polly).

## Non-negotiable security rules

1. **`user_id`/`profile_id` come ONLY from the JWT** — never from a request body or path parameter. Grep for violations.
2. **Object-storage access via presigned URLs scoped to one object under the caller's prefix** (`users/{account_id}/{profile_id}/…`). Bucket credentials never exposed.
3. **Destructive profile routes** (`/profiles/:id/reset`, `/profiles/:id/reset-chat`) assert ownership of `:id` against the JWT account (missing/foreign → 404) and are fronted by a two-step confirmation in the Profil tab. There is no PIN/parent elevation (the Eltern-Bereich + PIN were removed 2026-07-22).
4. **Access is gated by account status, not payment.** The family `JwtAuthGuard` requires `account.status='active'` (a per-request check) — `pending`/`deactivated`/deleted accounts can't act, and revocation is immediate. AI (`★`) endpoints are **free**; there is no entitlement/credit check (billing deferred, ARCHITECTURE §9).
5. **Signup is silent pending-on-first-code.** A first `/auth/request-code` for an unknown email creates a `pending` account and **emails nothing** (still `200`, no enumeration); a staff admin approves before any code is sent. The family UI says "we'll email you soon," never advancing to code entry.
6. **Never log** student answers, homework/OCR content, email addresses, login codes, JWTs, presigned URLs, or request/response bodies. Log identifiers + outcomes only.
7. **One error envelope** for every non-2xx response: `{error:{code,message,requestId,details[]}}`. The global exception filter handles this — never leak Prisma/provider errors.
8. **Staff user-administration is admin-role-only and sees identity.** Approve/deactivate/delete (`/staff/users/*`) handle real emails and are gated by `role='admin'` — kept separate from the pseudonymised reviewer queue (rule 10). Account deletion erases DB rows **and** the account's blobs.
9. **The two auth realms never cross.** `/staff/*` requires a staff cookie (`aud:"staff"`, `StaffAuthGuard`); a family JWT is rejected there and a staff cookie is rejected on every family route. Realms use **distinct signing keys** (`STAFF_JWT_SECRET` ≠ `JWT_SECRET`).
10. **The reviewer queue is pseudonymised.** `/staff/*` exposes only the homework image (per-upload presigned URL), the LLM draft, skill tags, and a grade band — never a student name, parent email, chat text, or billing. Homework's `llm_analysis` is a draft and **must not** mutate the learning profile before a reviewer verdict; only `reviewed_analysis` applies.

## Key conventions

- **Terminology:** the app's users are **students** (ages 8–14) — never "child/children" in docs, comments, or UI copy (German copy: "Schüler"). One legacy wire key keeps the old name for data compatibility: `childAnswer` in stored homework-analysis JSON. (`chat_message.role` was migrated to `'student'`; the read path still tolerates legacy `'child'` rows.)
- **Wire format:** camelCase JSON on the wire; snake_case DB columns. Prisma `@map`/`@@map` bridges them.
- **Validation:** Zod via `nestjs-zod` (`createZodDto`). The same Zod schemas drive Claude structured output (`zodOutputFormat` + `messages.parse`) so Exercise JSON stays typed end-to-end.
- **Contract pipeline:** Zod schemas (`backend/src/contract/*`) → committed `backend/openapi.json` (`npm run openapi:export`) → committed `frontend/src/lib/api.gen.ts` (`npm run gen:api`), with a CI drift gate. Never hand-edit `api.gen.ts`. A global `ZodResponseInterceptor` also validates every 2xx response against its schema at runtime (dev throws, prod logs+strips).
- **Auth:** session JWT (30-day) in an **httpOnly, Secure, SameSite cookie** (`/auth/verify` sets it, `/auth/logout` clears it); the SPA holds no token in JS and derives auth from a `/me` probe. No in-memory security state in prod — lockout counters (e.g. login-code attempts) are durable DB columns.
- **API versioning:** all routes under `/api/v1`. Breaking changes → `/api/v2`, never edit in place. Additive changes stay in v1.
- **Golden tests:** `digest.md` format (LLM-facing) and `Exercise` JSON (client-facing) are pinned with golden files. Any change to these contract outputs must update the golden files intentionally.
- **SVG-first media:** all app art, mascots (Nepo/Stella), icons, and badges are SVG. Sanitize any non-hand-authored SVG with DOMPurify before inlining — never `dangerouslySetInnerHTML` on raw SVG. Homework photos are the only raster exception (strip EXIF server-side, transcode to WebP).
- **Prisma 7 + NestJS:** Prisma 7 is ESM-first — set `moduleFormat = "cjs"` in the Prisma client generator config for NestJS's CommonJS setup.
- **Docs upkeep (keep them true):** a PR that changes routes, the Prisma schema, env vars, screens/tabs, or hosting must update the matching SPEC/ARCHITECTURE section in the same PR — and milestones (shipped + planned) are tracked only in the repo-root `ROADMAP.md`, ticked there when they ship. The lexeme foundation's schema→contract→overrides→editor extensibility pattern was dropped with the content set (2026-07-13, ROADMAP.md §F) — the new word-list schema's design, and whether it needs an equivalent pattern, is open.
- **Telemetry:** every answered exercise emits exactly one `POST /attempts` with a real `timeMs` (timer starts on item mount). Fire-and-forget; queue + retry offline via Workbox; never block the student's UI.

## Hosting & env

- **AWS**, region **Frankfurt (eu-central-1)** primary: small EC2 instance (backend, systemd, no container) + S3/CloudFront (frontends). The **beta deployment** (ROADMAP §E) is authored in `infra/` (Terraform) + `deploy/` (on-box scripts): for a €50/mo all-in budget it **self-hosts Postgres on the EC2 box** (not RDS), terminates TLS with **nginx + Let's Encrypt**, sends login-code email via **Amazon SES** (Terraform-managed DKIM; IAM-role auth, no key), and deploys from **GitHub Actions via OIDC → SSM Run Command** (no static keys, no SSH). Full-prod target (RDS, ALB, cross-region DR, OTel, staff MFA) is deferred — see ARCHITECTURE §7. Nothing is stood up until you `terraform apply`.
- Secrets in **SSM Parameter Store** — nothing secret in the repo. See `backend/SPEC.md §11` for the full env var list (`.env.example` is committed).
- Migrations run as a **pre-traffic release step** (`prisma migrate deploy`), never at app startup.
- PWA update strategy: **prompt-to-update** (never silent reload mid-lesson).
