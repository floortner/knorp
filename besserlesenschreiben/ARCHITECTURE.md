# ARCHITECTURE — besserlesenschreiben

Cross-cutting engineering agreement for the adaptive German literacy tutor. This document sits **above**
the two project specs (`backend/SPEC.md`, `frontend/SPEC.md`) and governs both. Where a spec and this
document disagree on a cross-cutting concern (API shape, errors, logging, versions, **hosting, payments,
media handling**), **this document wins**.

---

## 1. System topology

```
┌─────────────────────────┐         HTTPS / JSON          ┌─────────────────────────┐
│  FRONTEND (repo: -web)  │  ───────────────────────────▶ │  BACKEND (repo: -api)   │
│  Vite + React SPA / PWA │   family cookie (httpOnly)    │  NestJS · AWS EC2        │
│  static, S3+CloudFront  │ ◀───────────────────────────  │  (systemd, no container) │
│  child + parent areas   │                               │                          │
└─────────────────────────┘                               │                          │
┌─────────────────────────┐         HTTPS / JSON          │                          │
│ REVIEWER (repo: -review)│  ───────────────────────────▶ │                          │
│ Vite + React (staff)    │   staff cookie (httpOnly)     │                          │
│ homework review queue   │ ◀───────────────────────────  │                          │
└─────────────────────────┘                               └───────────┬─────────────┘
                                    AWS (Frankfurt eu-central-1)      │
              ┌───────────────────────┬──────────────────┬────────────┘
              ▼                       ▼                  ▼
   Amazon RDS for PostgreSQL   Amazon S3            Anthropic API      (TTS: Amazon Polly de-DE,
                               (per-user prefixes,  (sessions/          deferred — Web-Speech
                                presigned URLs)      chat/vision)       fallback in the client)
```

- **Three repos, deployed independently.** The two **frontends** (`-web` family app, `-review` staff portal)
  are static artifacts; the **backend** is a Node service. *Current reality:* all live in **one monorepo**
  (`besserlesenschreiben/{backend,frontend,reviewer}`) for fast cross-cutting iteration during Phase 1/1.5.
  They are kept independently buildable/deployable (separate `package.json`, CI jobs, env) and split into the
  `-api`/`-web`/`-review` repos before public launch — the contract pipeline (§4) is what makes that split a
  non-event. The reviewer portal is **internal-staff-only** (see §1a) and never shipped to families.
- **The boundary is the HTTP API contract** (`backend/SPEC.md §6`). No frontend reaches across it: the
  frontends hold no DB/business logic; the backend serves no HTML.
- Claude Design iterates on the screens; it changes how exercises *look*, never the data flow.

### 1a. Actors & identities — two disjoint auth realms

The system has **two completely separate identity realms**; a credential in one is never valid in the other,
and the JWTs carry a different `aud`/role so a guard can never confuse them.

| Realm | Who | Surface | Auth | Sees |
|---|---|---|---|---|
| **Family** | parent (account) + their children (profiles) | `-web` SPA/PWA | email login code → 30-day httpOnly family cookie; parent area re-gated by PIN | only their own account's data |
| **Staff** | internal literacy professionals ("reviewers") + admins | `-review` portal | own staff login → httpOnly **staff** cookie (`aud:"staff"`); MFA before prod | a **pseudonymised** review queue across all families — homework image + LLM draft only |

- **Reviewers are a small internal staff pool (~3 in v1), not tied to one family.** Accounts are
  **hand-provisioned by an admin** (no self-signup); they pull homework from a shared queue and are
  employees/contractors under a staff DPA, not a family's own teacher. There is **no per-family professional**
  in v1, and the pool is small enough that the queue is about preventing double-review, not load-balancing.
- **Minimisation at the realm boundary (hard rule):** a reviewer never sees a child's name, the parent email,
  free-text chat, billing, or any direct identifier. The queue exposes a **pseudonymous profile handle**
  (opaque id), coarse grade/age band, relevant skill tags, the homework **image**, and the **LLM draft
  analysis** — nothing more. This keeps staff access to minors' data scoped to exactly what the review task
  needs (§8).
- The reviewer's verdict is **authoritative** and **replaces the parent-confirm step** for homework
  (§10). Review is **asynchronous**: it never blocks a child mid-lesson; it shapes the *next* generated
  lecture.

### 1b. Family access = approval, not payment

The app is **free, including the AI features**; the owner retains control over *who gets in* through an
**approval gate**, not a paywall (§9 is deferred). Access is governed by a family **account lifecycle**:

**`account.status`: `pending → active → deactivated`** (plus hard **delete**).

- **Signup is silent pending-on-first-code.** A first `POST /auth/request-code {email}` for an unknown email
  **creates a `pending` account and sends nothing** (still a generic `200` — no account enumeration). The
  family UI then shows a clear "**we'll review your request and email you soon — not instantly**" state, so the
  user isn't left waiting for an email that isn't coming yet. No separate signup form.
- **An admin approves** the pending account in the staff portal (§1a) → status `active` → **only then** is the
  login code released by email and the account can sign in.
- **Deactivate** → `deactivated`: login refused and existing sessions stop working, but data is retained.
- **Delete** → account erased: DB cascade **plus** the account's blobs (homework images under
  `users/{account}/…`) — a real right-to-erasure for minors' data, not just a flag.

Because deactivate/delete must take effect **immediately** (not whenever a 30-day cookie expires), the family
`JwtAuthGuard` does a per-request account lookup and requires `status==='active'` — the same posture the staff
guard already uses for reviewer `status`. (Cost: one indexed read per request; worth it for control.)

**Two faces of the staff realm.** Homework **review** stays strictly **pseudonymised** (§1a). But **user
administration** (approve / deactivate / delete) inherently handles real identity (an email), so it is a
separate, **admin-role-only** surface — never mixed into the reviewer queue. Reviewers see pseudonymised
homework; admins see accounts. Same `Reviewer.role` (`reviewer | admin`) gates the difference.

---

## 2. Tech stack & pinned versions

> Versions verified against releases current as of **June 2026**. Pin the **exact** patch in lockfiles at
> install; let Renovate/Dependabot carry them forward. Treat the **major/minor** lines below as the contract.

### Frontend (`-web`)
| Concern | Choice | Version line |
|---|---|---|
| Runtime / build | Node.js (Active LTS "Krypton") | **24.x LTS** |
| Language | TypeScript | 5.x |
| UI library | React | **19.2.x** |
| Build tool | Vite (Rolldown engine) | **8.1.x** |
| React plugin | @vitejs/plugin-react | 6.x |
| Styling | Tailwind CSS (CSS-first `@theme`) + `@tailwindcss/vite` | **4.3.x** |
| Components | shadcn/ui (CLI, copied in-repo; Tailwind v4 + React 19 compatible) | current |
| Server state | @tanstack/react-query | **5.101.x** (v5) |
| Routing | React Router | 7.x |
| PWA | vite-plugin-pwa (Workbox) | current |
| Fonts | Atkinson Hyperlegible (body), Bricolage Grotesque (display) | — |

### Backend (`-api`)
| Concern | Choice | Version line |
|---|---|---|
| Runtime | Node.js (Active LTS "Krypton") | **24.x LTS** |
| Language | TypeScript | 5.x (6.0 emerging) |
| Web framework | NestJS (Fastify adapter) | **11.x** |
| Validation / DTOs | Zod (+ `nestjs-zod`) | **4.x** |
| OpenAPI | `@nestjs/swagger` (feeds frontend type-gen) | current |
| ORM | Prisma (+ `@prisma/adapter-pg`) | **7.x** |
| Migrations | Prisma Migrate | (Prisma 7) |
| Config | `@nestjs/config` + Zod-validated env | — |
| Logging | `nestjs-pino` (pino, structured JSON) | current |
| Database | PostgreSQL | **17** (18 fine) |
| Object storage SDK | `@aws-sdk/client-s3` (+ `@aws-sdk/s3-request-presigner`) — per-user prefixes, presigned URLs | v3 |
| LLM | `@anthropic-ai/sdk` (structured output via `zodOutputFormat`) | current |
| Scheduling | `ts-fsrs` (SM-2 fallback) | current |
| Tests | Vitest (Jest = Nest default alternative) | current |
| Lint / format / types | ESLint + Prettier · `tsc` | — |
| **Hosting (compute)** | Small AWS EC2 instance (Graviton, systemd — no container) | — |
| **Hosting (DB)** | Amazon RDS for PostgreSQL | PG 17 |
| **Hosting (objects)** | Amazon S3 | — |
| **Secrets** | AWS SSM Parameter Store (SecureString), fetched at boot | — |
| **Login email** | Amazon SES (or Resend/Postmark) | — |
| **Region** | Frankfurt (eu-central-1) primary · Ireland (eu-west-1) fallback | — |

**Backend-language decision (deliberate, revisitable):** **TypeScript/NestJS** is chosen for **one language
across both repos** — shared types, shared tooling, one mental model for a solo dev, and the ability to reuse
the same **Zod** schemas for API validation *and* Claude structured outputs (`zodOutputFormat`). NestJS gives
FastAPI-equivalent batteries (DI, validation pipes, auto-OpenAPI via `@nestjs/swagger`) and mirrors the clean
controller/service layering this doc already assumes. **Python/FastAPI** was the alternative and remains the
stronger pick *if* the AI/ML side grew heavy (richer data tooling, `fsrs`); the trade accepted here is a
slightly less rich ML ecosystem in exchange for full-stack TS. Decision: **NestJS for v1.** Do **not** split
into two backend languages without a measured reason.

**Dependency hygiene:** lockfiles committed (`package-lock.json` both repos). Renovate opens grouped PRs
weekly. Majors are reviewed by hand; patches auto-merge on green CI. **Prisma 7** ships ESM-first — with
NestJS's CommonJS setup, set `moduleFormat = "cjs"` in the client generator.

> React 19's early "React2Shell" advisory is patched in the 19.2.x line — use a current patch, not 19.0.x.

---

## 3. Project structure

### Backend `-api`
```
src/
  main.ts                 # bootstrap: Fastify adapter, Swagger, pino, global ValidationPipe + filters
  app.module.ts           # root module wiring feature modules
  config/                 # @nestjs/config + Zod-validated env schema
  prisma/
    prisma.service.ts     # PrismaClient lifecycle (OnModuleInit/Destroy)
  common/
    guards/               # JwtAuthGuard (family) · ParentScopeGuard · StaffAuthGuard (staff, §1a) + admin-role check
    filters/              # all-exceptions filter → the §5 error envelope
    interceptors/         # requestId + logging
    security/             # JWT, argon2 PIN hashing, rate limiting
  modules/                # one folder per resource: controller (HTTP) + service + Zod DTOs
    auth/  profiles/  sessions/  attempts/  progress/
    chat/  homework/  parent/         # (no billing/ module — billing deferred, §9)
    staff/                # STAFF realm (§1a): reviewer auth, review queue + authoritative apply,
                          #   admin user administration, learner progress (lexeme curation dropped, §F)
  services/               # DOMAIN logic only — plain injectables, NO controllers/HTTP here (dtctl lesson)
    digest/               # derived markdown performance digest
    fsrs/                 # scheduling (ts-fsrs)
    llm/                  # provider abstraction (Anthropic-direct + dev stub), structured output
    storage/              # S3 presigned URLs / local-FS dev store (+ local image endpoint)
    email/                # login-code delivery (console | ses | resend | capture)
prisma/
  schema.prisma           # the model truth (account, profile, item_bank, attempt, …). The `lexeme` model
                           # + the Vokaltraining content set were dropped 2026-07-13 (ROADMAP.md §F) — the
                           # word-list schema is being redesigned.
  seed.ts                 # idempotent loader: staff admins + dev accounts (content seeding dropped with §F)
scripts/
  export-openapi.ts  seed-e2e.ts  llm-smoke.ts
                           # `item_bank.seed.json` and its generation scripts were deleted with the
                           # Vokaltraining content set (ROADMAP.md §F) — re-add once new content is seeded.
test/                     # Vitest; incl. golden snapshots for digest.md + Exercise JSON
package.json  package-lock.json  tsconfig.json  eslint.config.mjs  .env.example  AGENTS.md
```

### Frontend `-web`
```
src/
  main.tsx  App.tsx
  lib/
    api.ts                # typed fetch client — mirrors backend/SPEC.md §6 EXACTLY
    queryClient.ts        # TanStack Query config
    telemetry.ts          # attempt timing + emit (frontend SPEC §4)
  app/                    # shell, routing, tabs (lernen | liga | profil | chat), parent area
  features/
    exercises/            # the Exercise union type (currently a single `placeholder` scaffold — the
                          # Vokaltraining renderer set was dropped, ROADMAP.md §F) + audio.ts (audio_url
                          # playback + Web Speech fallback)
    auth/  lessons/  progress/  profile/   # homework upload lives in the Chat tab; no billing/ — the app is free
  components/ui/          # shadcn components
  hooks/  styles/theme.css (@theme tokens)
public/                   # PWA icons (SVG), manifest, brand svgs (nepo.svg)
monster-pets/             # served mascot SVGs (base + moods/poses), symlinked into public/monster-pets
                          #   (master source art + catalog live at repo-root assets/ — see § Media)
index.html  vite.config.ts  package.json  package-lock.json  .env.example  AGENTS.md
```

### Reviewer `-review` (internal staff portal)
```
src/
  main.tsx  App.tsx        # providers + routes: /login, /login/code, /queue, /review/:uploadId, /users
                           # (/lexemes dropped with the Wortschatz tab, ROADMAP.md §F)
  index.css               # neutral staff @theme tokens (teal accent, slate surface) — no PWA, no mascots
  app/AppLayout.tsx       # top bar: (b) brand + reviewer name, nav with live count badges, logout
  lib/
    api.ts                # transport only over the STAFF routes — staff cookie, error-envelope → ApiError
    api.gen.ts            # GENERATED from the backend OpenAPI (`npm run gen:api`), committed, never edited
    contract.ts           # ergonomic aliases over the generated `operations` (no hand-authored shapes)
    endpoints.ts          # typed wrappers: staffAuthApi, reviewApi, usersApi
  features/
    auth/                 # StaffAuthProvider, /staff/me probe, RequireStaff guard, login + code screens
    queue/                # review list (Offen | Erledigt | Alle) — pseudonymised rows
    review/               # image + LLM draft SIDE BY SIDE; approve | correct | reject (+ AnalysisEditor)
    users/                # ADMIN: account approval / deactivate / delete + per-child progress
                          # (the "Wortschatz" lexeme-curation tab was dropped with the content set, §F)
    progress/             # shared learner-progress panel (summary · skills · activity)
  components/ui/          # button, input, select, textarea, modal, filter-chips
index.html  vite.config.ts  package.json  .env.example  README.md  AGENTS.md
```
The reviewer portal is **transport + UI only** — every decision (queue ordering, authoritative apply, who may
review) is enforced by the backend `staff/` module. It ships to ~3 internal staff, never to families, and
authenticates on the disjoint **staff** realm (§1a). **Form factor: desktop/tablet, landscape two-pane** (image
| LLM draft) — **not** mobile-first; skip phone layouts (that's the family app's job, §11). Types are generated
from the backend's published `/staff/*` OpenAPI (`npm run gen:api`) and drift-gated in CI.

`features/exercises/types.ts` (the `Exercise` discriminated union) and `lib/api.ts` are the two files that
**must** stay in lockstep with the backend contract. Treat a change to either as a contract change (§4).
`lib/api.ts` is **transport only** — no JSX, no UI; `services/` on the backend is **logic only** — no HTTP
imports. Keeping those layers pure (a pattern lifted from dtctl's `sdk/`) is what lets either side change
independently.

**`AGENTS.md` per repo** (also a dtctl practice): a short file telling Claude Code the conventions —
test/lint commands, "never edit the API shape without regenerating `api.ts` from OpenAPI", the SVG-first
media rule, and the security-boundary invariants. It measurably improves agent output; keep it current.

---

## 4. API rules

- **Base path & versioning:** every route under `/api/v1`. The major version is the cross-repo contract;
  a breaking change means `/api/v2`, not an in-place edit. Additive (backward-compatible) changes stay in v1.
- **Transport:** JSON only (`application/json`), UTF-8. `multipart/form-data` solely for `/homework` upload.
- **Auth:** the session JWT (30-day TTL) is delivered as an **httpOnly, Secure, SameSite=Lax cookie** set on
  `/auth/verify` and cleared on `/auth/logout`. The browser SPA holds **no token in JS** — it derives auth from
  a `/me` probe, so a refresh never logs the child out. `JwtAuthGuard` also accepts `Authorization: Bearer <jwt>`
  for non-browser/API clients. Parent-scoped routes additionally require a fresh `parent` claim (SPEC §4).
  (Refresh-token rotation is deferred; the 30-day cookie is the v1 posture.)
- **Naming:** resource nouns, plural, kebab-free snake in JSON bodies is *not* used — **JSON uses camelCase**,
  DB columns use snake_case; the backend maps between them. Pick one and never mix on the wire: **camelCase wins.**
- **Status codes:** `200` ok · `201` created · `204` no body · `400` malformed · `401` unauthenticated ·
  `403` authenticated-but-forbidden (incl. missing parent scope) · `404` · `409` conflict ·
  `422` validation · `429` rate-limited · `5xx` server. (`402` is **deferred** — reserved for paid tiers, §9.)
- **Idempotency:** `POST /attempts` must be idempotent (dedupe on `(session_id, item_id, attempt_no)`).
  The billing webhook's idempotency (on the provider event id) is preserved but **deferred** (§9).
- **Correlation:** the backend assigns an `X-Request-Id` per request (or echoes the client's). It appears in
  every log line and in error envelopes. The frontend generates one per user action and sends it.
- **Pagination:** cursor-based where lists can grow (`?limit=&cursor=`); responses carry `nextCursor`.
- **Rate limits:** auth-code request/verify and parent-PIN verify are strictly limited (SPEC §4). Gated AI
  endpoints are limited per account. `429` responses include `Retry-After`.
- **CORS:** backend allows only the known web origin(s) from config; credentials enabled (for the cookie).
- **The contract is generated, not hand-drifted** (the **contract pipeline**):

  ```
  Zod schemas (src/contract/*)               # the single source of truth
     │  z.toJSONSchema(target:'openapi-3.0')  +  @nestjs/swagger
     ▼
  openapi.json   (committed)                 # exported via `npm run openapi:export`
     │  openapi-typescript
     ▼
  api.gen.ts     (committed, frontend)       # generated via `npm run gen:api` — NEVER hand-edit
     │
     ▼
  CI drift gate: re-run gen:api && git diff --exit-code  →  red on any drift
  ```

  The same Zod schemas drive Claude structured output (`zodOutputFormat`), so Exercise JSON stays typed
  end-to-end. Changing a request/response shape means editing the Zod schema, then re-running both
  generators and committing the result.
- **Responses are validated at runtime, not just documented.** A global `ZodResponseInterceptor` re-`parse`s
  every 2xx body against the same Zod schema the endpoint published (`ApiZodResponse`): in dev it throws on a
  mismatch (so drift surfaces in tests), in prod it logs and strips unknown keys. The published contract
  therefore cannot silently diverge from what services actually return.

---

## 5. Error handling

**One envelope for every non-2xx response. No exceptions.**

```json
{
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Human-readable, safe to surface in the parent area.",
    "requestId": "req_8f3a…",
    "details": [ { "field": "code", "issue": "expired" } ]
  }
}
```

**Error code catalog (stable strings the frontend switches on — never parse `message`):**

| HTTP | `code` | Frontend behaviour |
|---|---|---|
| 401 | `UNAUTHENTICATED` / `SESSION_EXPIRED` | route to `/login`, show "Sitzung abgelaufen" |
| 403 | `PARENT_SCOPE_REQUIRED` | prompt parent PIN |
| 403 | `FORBIDDEN` | generic "not allowed" |
| 402 | `INSUFFICIENT_CREDITS` / `TIER_REQUIRED` | **deferred (§9)** — not emitted today; the app is free |
| 422 | `VALIDATION_ERROR` | field-level messages from `details[]` |
| 429 | `RATE_LIMITED` | back off using `Retry-After`; soft message |
| 404 | `NOT_FOUND` | — |
| 409 | `CONFLICT` | — |
| 503 | `PROVIDER_UNAVAILABLE` | AI/TTS provider down; retry later — **no credit consumed** |
| 500 | `INTERNAL` | generic apology + `requestId`; nothing technical |

**Backend rules**
- All exceptions funnel through the all-exceptions filter in `common/filters/` that emits the envelope above. No raw stack
  traces, ORM errors, or provider errors ever reach the client — they're logged with the `requestId` and
  replaced by `INTERNAL`.
- Zod validation failures (via `nestjs-zod`) are reshaped into `VALIDATION_ERROR` with a `details[]` array (field + issue).
- **Never leak** which emails exist (`/auth/request-code` always `200`), whether a PIN was "close",
  or any other account-enumeration signal.
- Expensive AI ops wrap provider failures: on Anthropic/TTS error, return `503 PROVIDER_UNAVAILABLE` and
  **do not** consume a credit.

**Frontend rules**
- A single error interceptor in `api.ts` maps `code → action` per the table; components don't hand-roll
  error parsing.
- `401/SESSION_EXPIRED` clears auth state and redirects once (no loops).
- Telemetry (`POST /attempts`) failures are swallowed and queued (PWA offline queue), never surfaced to a
  child mid-exercise.
- Always show `requestId` on a hard error so a parent can quote it in support.

**Retries:** idempotent GETs and `POST /attempts` retry with exponential backoff + jitter (max ~3). Never
auto-retry non-idempotent POSTs (checkout, homework upload, chat send).

---

## 6. Logging agreement

**Structured JSON, one event per line, machine-parseable.** Backend uses `nestjs-pino` (pino); frontend uses a thin
wrapper over `console` (optionally shipping warn/error to Sentry).

**Every backend log line carries:** `timestamp`, `level`, `event`, `requestId`, `accountId` (if authed),
`route`, `latencyMs`, `status`. Never the `profileId` of a child alongside content.

**Levels**
- `DEBUG` — local only; never enabled in prod.
- `INFO` — request completed, session generated (counts, source), webhook processed, migration ran, homework
  review actioned (`{event:"homework.reviewed","reviewerId":"…","uploadId":"…","decision":"corrected","agreedWithLlm":false}` — ids + outcome, never the analysis content).
- `WARNING` — rate-limit hit, credit exhausted, provider slow/retried, PIN lockout, staff-auth failure.
- `ERROR` — unhandled exception (with `requestId`), provider failure, webhook signature mismatch.

**NEVER log (this is a children's app — treat it as the hard line):**
- The contents of exercises a child answered, their answers, or homework image contents / OCR text.
- Email addresses, the 4-digit login code, the parent PIN (or its hash), JWTs, cookies, presigned storage URLs.
- Full request/response bodies. Payment tokens or provider secrets.
- Any field that, combined, re-identifies a specific child's performance.

Log **identifiers and outcomes, not payloads**: `{"event":"session.generated","accountId":"…","source":"bank","items":8}` — never the items themselves.

**Telemetry vs logs are different systems.** Learning telemetry (the `attempt` rows) is **product data** in
Postgres, governed by the SPECs and consent — it is *not* operational logging and must never be duplicated
into the log stream. Logs are for running the service; they are short-retention and contain no learning content.

**Destinations & retention:** stdout JSON → platform log aggregator. Operational logs retained ~30 days.
Errors optionally mirrored to Sentry (scrub PII in `beforeSend`). Raw homework images: short retention per
SPEC §10, deleted on a schedule, EU residency.

---

## 7. Build · update · distribution

**Hosting: AWS**, region **Frankfurt (eu-central-1)** primary — data at rest in the EU (AWS has no Austria
region; Frankfurt is the closest EU location). **Ireland (eu-west-1)** is the EU fallback/DR region.

> **Beta deployment (round 1, ROADMAP §E).** The first-feedback-round environment is implemented in
> `infra/` (Terraform) + `deploy/` (on-box scripts) and **deliberately deviates from the full-prod target
> below to fit a €50/mo all-in budget**: Postgres is **self-hosted on the same EC2 box** (not RDS) with an
> off-platform encrypted `pg_dump` as its safety net; TLS is **nginx + Let's Encrypt** (no ALB); there is
> **one region, no DR-region copy**; observability is **OpenTelemetry as the chosen approach but not yet
> built** (Sentry dropped); and **staff MFA is a conscious beta exception** (email-code only, ~3 admin-seeded
> reviewers). Deploys run from **GitHub Actions via OIDC → a scoped role → SSM Run Command** (no static AWS
> keys, no inbound SSH). The full-prod design below (RDS, ALB/multi-instance, cross-region DR, OTel build-out,
> MFA) is the target these deviations graduate to. *Local dev needs none of it.*

### Backend
- **Compute:** a **small EC2 instance** (t4g Graviton), running `node dist/main.js` under **systemd** — no
  container, no registry. TLS via nginx + Let's Encrypt (or an ALB). App Runner is the noted future option if
  containerising ever pays for itself.
- **Database:** **Amazon RDS for PostgreSQL**, automated backups on, snapshot copy to the DR region above.
- **Objects:** **Amazon S3**, one bucket, per-user prefixes (`users/{account}/{profile}/…`), access via
  short-lived **presigned URLs** scoped to a single object; the app authenticates via the **IAM instance
  role** (default credential chain — no keys in env). Lifecycle policy auto-deletes raw homework images on
  schedule.
- **Secrets:** **SSM Parameter Store (SecureString)**, fetched at boot; nothing in the repo or on disk.
- **Health:** `GET /api/v1/health` → `{status, version, commit}` for the load-balancer/uptime probe.
- **Migrations:** `prisma migrate deploy` runs as a **pre-traffic release step** (never at import). Forward-only,
  expand→migrate→contract so rollouts are zero-downtime and rollback-safe.
- **Seed:** `npm run seed` (`prisma db seed` → `prisma/seed.ts`) is idempotent; run on first deploy and when the seed JSON changes.

### Backups & off-platform disaster recovery
The in-AWS cross-region backup above survives a *regional* incident, but **not** an account-level event — a
billing dispute or policy flag can suspend the account and take compute, database, **and** objects offline
simultaneously. The cheap insurance is to keep an independent copy **outside AWS**, so an account problem
costs uptime, not data and users.

- **Postgres:** scheduled `pg_dump` (daily; a cron on the instance or GitHub Actions) → compressed,
  **client-side encrypted** (age/gpg) → pushed to a **different provider** (e.g. Cloudflare R2, Backblaze B2,
  or another cloud's object storage). Keep the in-AWS automated backups too; this is the off-platform tier.
- **Objects:** periodic export of the user prefixes (`users/{account}/{profile}/…` — homework images, generated
  sessions/digests, TTS audio) to the same off-platform target, encrypted. TTS audio is regenerable so it's
  lowest priority; child homework + learning artifacts are the priority.
- **Retention:** short rolling window (e.g. 7 daily + 4 weekly), aligned with the minors'-data retention
  posture in §8 — backups are not an excuse to keep child data forever; expire them on the same clock.
- **Encryption & access:** the off-platform copy is encrypted with a key **not stored in SSM/AWS**
  (otherwise an account freeze locks you out of your own backups). Hold that key separately.
- **Restore drills:** a backup you haven't restored is a hope, not a backup. Periodically rebuild Postgres from
  a dump into a throwaway instance and verify row counts + a sample profile. Document the restore runbook.
- **Scope:** this is **disaster recovery, not analytics** — encrypted archives, not a queryable mirror, and
  subject to the same "no child content in logs/exports we don't need" discipline as everything else.

Result: an AWS account suspension becomes a recoverable outage (stand the app + DB back up elsewhere,
restore from the off-platform dumps) rather than the loss of every family's data.

### Frontend
- **Build:** `vite build` → hashed, immutable static assets + `index.html`.
- **Distribution:** **S3 + CloudFront** (both frontends; the reviewer portal on its own origin). Cache policy:
  hashed assets `immutable, max-age=1y`; `index.html` + service worker `no-cache` so deploys are picked up
  immediately.
- **PWA update strategy (important):** vite-plugin-pwa + Workbox, **prompt-to-update** (never silent reload
  mid-lesson). On new SW detected → let the current exercise finish, then a gentle "Neue Version verfügbar –
  neu laden?" in the shell/parent area, never interrupting a child's answer. App shell precached → installable
  and offline-capable.
- **Offline:** the attempt queue (frontend SPEC §4) flushes on reconnect via Workbox background sync.

### Versioning & releases
- **SemVer per repo.** Version + commit injected at build (`VITE_APP_VERSION` / backend `version`) and shown
  in `/health` and the parent "About" — a pattern borrowed from dtctl's `ldflags` version stamping.
- **The API version (`/v1`) is the cross-repo contract** and moves independently of repo SemVer.
- Tag releases; `CHANGELOG.md` per repo. A frontend deploy must never assume an unreleased backend route.

### CI/CD (GitHub Actions)
- Implemented in `.github/workflows/ci.yml` (monorepo: one workflow with `backend`, `frontend`, and
  `reviewer` jobs; on push to `main` + all PRs). The top-level Playwright suite (`e2e/`) is **run locally
  only, not in CI** (`cd e2e && npm test`). On the repo split each job moves to its own repo unchanged.
- Frontend: install → typecheck (`tsc`) → lint → unit + **golden** tests → `vite build`. (Deploy to
  S3+CloudFront on `main` lands with the deployment milestone.)
- Backend: `npm ci` → lint (ESLint) → typecheck (`tsc --noEmit`) → `vitest` (incl. **golden** tests) →
  `prisma generate` → build. (Release to EC2 + `prisma migrate deploy` as a pre-traffic step lands with the
  deployment milestone.)
- **Contract check:** regenerate `api.ts` types from the backend OpenAPI and fail the frontend build on drift.
- **Golden/snapshot tests (dtctl lesson):** the two outputs that are *contracts* — the `digest.md` format
  (LLM-facing) and the `Exercise` JSON (client-facing) — are pinned with golden files built from real structs.
  A change to either is then visible in the diff and reviewed deliberately, never silent.

---

## 8. Configuration, security & data residency (cross-cutting)

- **Config is env-only**, typed via `@nestjs/config` + a Zod env schema (backend) and `import.meta.env` (frontend). Every var
  is documented in a committed `.env.example`; **no secret is ever committed**. Secrets live in **SSM
  Parameter Store (SecureString)**. Full var list: `backend/SPEC.md §11`.
- **Security boundary (recap, non-negotiable):** `user_id`/`profile_id` derive only from the JWT; object-storage
  access is via **short-lived presigned URLs scoped to a single object** under the caller's prefix (never a
  path from the client); routes are gated by **account status (approved/active, §1b)** + **parent-scope** where
  needed (entitlement/credit gating is deferred, §9); PIN and login code are hashed and rate-limited.
- **No in-memory security state in prod.** Anything that gates access — PIN-lockout counters, rate-limit
  windows — lives in a durable store (DB columns / Redis), never a process-local Map. A restart or a second
  replica must never reset a lockout (a brute-force hole). The parent-PIN lockout (5 fails / 15 min) is
  persisted on `account` (`pin_attempts`, `pin_locked_until`).
- **LLM access is abstracted.** AI work (free, but access-gated by account status) goes through a single
  swappable `LlmService` (Anthropic-direct is the default) so the provider could move (e.g. Bedrock /
  Vertex EU) without touching callers. **EU data-residency for minors is a hard gate before any production LLM
  call** — see the data-flow options below.
- **Staff access to minors' data (reviewers).** Homework review (§11) means internal staff see a child's
  homework photo — the strongest minors'-data exposure in the system. Gate it hard: (a) reviewers are a small,
  **vetted, DPA-bound** staff pool with named accounts and MFA, never anonymous; (b) the queue is
  **pseudonymised** — image + LLM draft + skill tags + grade band only, no name/email/chat/billing (§1a); (c)
  every reviewer action (claim, approve, correct, reject) is **audit-logged** with the staff id and upload id
  (identifiers + outcome, never image/answer content — §6); (d) consent copy at upload states that a homework
  photo is reviewed by a trained professional to tailor lessons; (e) raw images expire on the §7 lifecycle
  regardless of review state. An admin can revoke a reviewer; queue claims are released on revoke.
- **Minors' data:** primary region **Frankfurt (eu-central-1)** keeps data at rest in the EU; DR backups stay
  within the EU (eu-west-1). Explicit parent consent for homework images; short retention via the S3 lifecycle;
  the logging rules in §6 are part of this commitment. **LLM data-flow (decided):**
  1. **Anthropic API direct (chosen).** Simplest path and always the newest models. For EU inference
     residency, pin `inference_geo: "eu"` on supported models (Sonnet 4.6+). It's an external seam: keep a
     **DPA**, send the *digest* (not raw child identifiers) where possible, and document the data flow.
  2. **Claude via Bedrock or Vertex AI (EU regions).** Fallback escape hatches only if a strictly
     cloud-internal data boundary is ever required — at the cost of feature lag (no same-day models,
     missing platform features) and a heavier integration.
  Whichever is used, the same rules hold: **DPA in place, send the digest not raw identifiers where possible,
  and document the data flow.** TTS (Amazon Polly, deferred) follows the same DPA + minimal-data discipline.
  - **Model policy (Anthropic-direct default):** `ANTHROPIC_MODEL` = `claude-sonnet-4-6` (generation/chat),
    `ANTHROPIC_VISION_MODEL` = `claude-opus-4-8` (homework OCR — accuracy-critical). On current models
    `temperature`/`top_p`/`top_k` are rejected (400): steer with the prompt (and output effort), not sampling
    params. Stable system prompts are sent as prompt-cacheable blocks. Structured output is a forced tool over
    the `src/contract` Zod→JSON-Schema, re-validated (incl. solvability) with a one-shot re-ask on a miss.
- **Observability:** `requestId` threads request → logs → error envelope → support. Optional Sentry on both
  ends with PII scrubbing. Health checks drive systemd/uptime-monitor restarts.

---

## 9. Payments — **DEFERRED (not built; the app is free)**

Current product decision: **free, including the AI features** (chat, homework vision, LLM-generated lessons,
premium TTS). Access is **gated by staff approval, not payment** (§1b). There is **no** billing module, checkout,
webhook, `EntitlementGuard`, credit enforcement, or billing UI anywhere. `★` on an endpoint just marks an
"AI-backed / cost-bearing op" — free today for any approved, active account; the marker only flags what *could*
be metered later. The former dormant `entitlement` / `credits_ledger` / `processed_webhook` tables have been
**dropped** from the schema (they were dead weight for an unbuilt feature).

**Reserved seam (only if metering is ever introduced — its own milestone, not current):** use a **Merchant of
Record** (Lemon Squeezy / Paddle) so card data never touches the backend and EU VAT/OSS is filed for you — a
hosted checkout, a signed **idempotent** `POST /billing/webhook` (on the provider event id) that updates an
`entitlement` + append-only `credits_ledger` (re-added by migration), billing UI **parent-area-only** (never
shown to a child), and an optional pay-it-forward subsidy. No lives/energy/loot mechanics, ever.

---

## 10. Media & image handling — **SVG-first**

**Policy: every app-authored or generated visual is SVG.** Mascots (Nepo/Stella), the "b" logo mark, badges,
reward art, exercise illustrations, icons, decorative elements — all SVG. Rationale that matters *for this app*:

- **DPI-independent** — crisp on every phone/tablet a child might use, no `@2x/@3x` asset sets.
- **Tiny** — a few KB, often inlineable; fast on weak connections.
- **Themeable** — `currentColor` + CSS vars let the same asset adapt to high-contrast / accessibility modes
  (which this app needs) without re-exporting.
- **Animatable** — the prototype already animates confetti/feedback; SVG keeps that cheap.
- **Diffable** — SVG is text, so changes show up in PRs (raster blobs don't).

**Pipeline**
- Author/optimize SVGs with **SVGO**. The master mascot/art library + catalog lives at repo-root `assets/`
  (SVG masters versioned; large PNG renders gitignored — print-only); the served subset is `frontend/monster-pets/`
  (symlinked into `public/`). Generated art goes to S3.
- **Sanitize every SVG that isn't hand-authored by you** (LLM-generated or uploaded) before storing/serving —
  SVG can carry `<script>`/`onload` and is an XSS vector. Use **DOMPurify** (`USE_PROFILES:{svg:true}`) on the
  frontend for any inlined SVG, and a server-side sanitizer before persisting. **Never** inline an unsanitized
  SVG via `dangerouslySetInnerHTML`.
- Prefer **inline** SVG for themeable/animated icons; `<img src=…svg>` for static decorative art.
- **Emoji** (the prototype uses 🍎🦔🌸 in exercises): keep as Unicode, or swap to an SVG emoji set (e.g. Twemoji)
  if you want identical rendering across devices — a real concern when a letter's *Anlaut* depends on the child
  recognising the picture.

**The one unavoidable raster exception: homework photos.** A camera photo of a worksheet is inherently raster
and must **not** be faked into SVG. Handle it as the deliberate exception:
- Accept **WebP/JPEG/PNG**; transcode to **WebP** for storage (smaller), keep one original for re-analysis.
- **Strip EXIF on upload** — phone photos embed GPS/time; for a child's image that metadata is a privacy
  hazard and must be removed server-side before the blob is persisted.
- Downscale to a sane max dimension before sending to the vision model (cost + speed); store under the user
  prefix with the lifecycle auto-delete from §7.
- The *output* of vision analysis is structured JSON / markdown (§ SPEC §10), not an image — so everything
  downstream of the photo is back to text/SVG.

---

## 11. Homework review — professional-in-the-loop (authoritative human gate)

Child handwriting OCR is unreliable and the stakes (shaping a struggling child's lessons) are high, so a
homework photo's LLM analysis is **never** applied on its own. A vetted **internal literacy professional**
(staff reviewer, §1a) validates it first. The reviewer's verdict is **authoritative** and **replaces** the
former parent-confirm step. The flow is **asynchronous** — the child is never blocked.

```
family uploads photo (Chat tab) ─▶  backend: strip EXIF, →WebP, store under user prefix
        │                                          status = pending_analysis
        ▼
Claude vision (★, gated)  ──▶  llm_analysis (DRAFT, NOT applied)   status = pending_review
        │                                          ▼  enqueued to the shared review queue
        ▼
REVIEWER PORTAL (-review):  reviewer pulls next item, sees image + LLM draft SIDE BY SIDE,
        approves as-is │ corrects fields │ rejects (unreadable / not homework)
        │                                          status = reviewed | rejected
        ▼
backend applies the REVIEWED analysis (authoritative) ──▶ derived attempt rows + review_state
        │   records llm-vs-reviewer diff (LLM-quality signal)
        ▼
next generated lecture (§ SPEC §9) consumes the validated focus skills;
the family chat shows the verdict as a status bubble (informational, non-blocking)
```

**Invariants (non-negotiable):**
- **Nothing mutates the learning profile before a reviewer verdict.** `llm_analysis` is a draft; only the
  `reviewed_analysis` writes `attempt`/`review_state`. (Replaces the old "before parent confirm" rule.)
- **The LLM draft and the reviewer's correction are both retained** as an append-only review record, with an
  `agreed_with_llm` flag — this is how we measure and improve vision quality over time ("compare against the
  LLM response"). It is product/QA data, governed like learning telemetry (§6), never operational logging.
- **The reviewer sees pseudonymised data only** (§1a): image + draft + skill tags + grade band, never the
  child's name, parent email, chat, or billing.
- **Async, never blocking:** review latency lands in the *next* lecture, not the current lesson. A pending or
  rejected upload simply means the next lecture isn't yet homework-informed.
- **Rejected** uploads (unreadable, not homework, or contains unexpected personal data) mutate nothing and are
  deleted on the raster-retention schedule (§7).

The reviewer portal is a thin client over backend endpoints (`backend/SPEC.md §6` staff routes); it holds no
business logic. Reviewer auth, queue claiming (to avoid double-review), and the authoritative-apply step all
live in the backend.

**Scale & form factor (deliberately small):** the staff pool is **~3 reviewers** in v1 — a tiny, fixed,
hand-provisioned set (no self-signup; an admin seeds the `reviewer` rows). Design accordingly: the queue and
claim-lease exist to stop *two* people grabbing the same item, not to load-balance hundreds; throughput is
not a concern, correctness and auditability are. The portal targets **desktop/laptop and tablet** (staff want
room to see the homework photo and the LLM draft side by side) — it is **not** optimised for phones. Build the
review screen as a two-pane **landscape** layout (image | draft) with comfortable tap targets for tablet; a
narrow-phone layout is explicitly out of scope (the family `-web` app is the mobile-first one, not this).
