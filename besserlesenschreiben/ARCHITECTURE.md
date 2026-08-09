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
│  student app (family)     │                               │                          │
└─────────────────────────┘                               │                          │
┌─────────────────────────┐         HTTPS / JSON          │                          │
│ TRAINER (repo: -trainer)│  ───────────────────────────▶ │                          │
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

- **Three repos, deployed independently.** The two **frontends** (`-web` family app, `-trainer` staff portal)
  are static artifacts; the **backend** is a Node service. *Current reality:* all live in **one monorepo**
  (`besserlesenschreiben/{backend,frontend,trainer}`) for fast cross-cutting iteration during Phase 1/1.5.
  They are kept independently buildable/deployable (separate `package.json`, CI jobs, env) and split into the
  `-api`/`-web`/`-trainer` repos before public launch — the contract pipeline (§4) is what makes that split a
  non-event. The trainer portal is **internal-staff-only** (see §1a) and never shipped to families.
- **The boundary is the HTTP API contract** (`backend/SPEC.md §6`). No frontend reaches across it: the
  frontends hold no DB/business logic; the backend serves no HTML.
- Claude Design iterates on the screens; it changes how exercises *look*, never the data flow.

### 1a. Actors & identities — two disjoint auth realms

The system has **two completely separate identity realms**; a credential in one is never valid in the other,
enforced by **distinct signing keys** (boot-asserted `STAFF_JWT_SECRET` ≠ `JWT_SECRET`); staff tokens
additionally carry `aud:"staff"`, which the family guard explicitly rejects as defence-in-depth.

| Realm | Who | Surface | Auth | Sees |
|---|---|---|---|---|
| **Family** | parent (account) + their students (profiles) | `-web` SPA/PWA | email login code → 30-day httpOnly family cookie | only their own account's data |
| **Staff** | internal literacy professionals ("trainers") + admins | `-trainer` portal | own staff login → httpOnly **staff** cookie (`aud:"staff"`); MFA before prod | all students **by name** + their learning data (known-trainer model, §H1.3) — never parent email/chat/billing |

- **Trainers are a small internal staff pool (~3 in v1), not tied to one family.** Accounts are
  **hand-provisioned by an admin** (no self-signup); they pull homework from a shared queue and are
  employees/contractors under a staff DPA, not a family's own teacher. There is **no per-family professional**
  in v1, and the pool is small enough that the queue is about preventing double-review, not load-balancing.
- **Minimisation at the realm boundary (hard rule):** trainers work under the **known-trainer model** —
  they know each student personally and see the student's **name**, grade band, skill tags,
  session/attempt activity, the homework **image**, and the **LLM draft analysis**. What a trainer
  **never** sees: the parent email, free-text chat, billing, or account lifecycle — those stay on the
  admin-only surface. This keeps staff access to minors' data scoped to what the teaching task needs (§8).
- The trainer's verdict is **authoritative** and **replaces the parent-confirm step** for homework
  (§10). Review is **asynchronous**: it never blocks a student mid-lesson; it shapes the *next* generated
  lecture.
- **Content authoring is a third ROLE, not a realm (2026-07-26 ROADMAP §I; solo model 2026-08-06,
  HISTORY.md pivot log).** All lecture content is authored as markdown files in the repo's `content/`
  directory — currently by our one linguist, **Angelika** (non-technical), working in-repo via
  Claude Code sessions under `content/CLAUDE.md` (`/neue-lektion`, `/abgeben`) — and the **deploy
  pipeline is the role's "write API"** (PR → CI validation → merge → versioned import, §7). The
  authoring path requires **no app credential in either realm** and must never depend on staff
  access. (Angelika *additionally* holds a trainer account — as a trainer she sees student data
  under the known-trainer model above; the authoring role itself never does.) The trainer portal
  consumes the lectures read-only (browse + assign + outcomes — it does not author). The authoring
  role's **read channel** is the planned anonymized content-stats report exported into the repo
  (§12, ROADMAP §J4) — content-indexed aggregates only, never per-student data, because repo access
  sits outside the staff DPA.

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
guard already uses for trainer `status`. (Cost: one indexed read per request; worth it for control.)

**Two faces of the staff realm.** Trainer surfaces (queue, review, learner directory + activity) show
students by name with their learning data (§1a, known-trainer model). **User administration**
(approve / deactivate / delete) additionally handles the **account** identity (the parent email), so it is
a separate, **admin-role-only** surface — never mixed into the trainer surfaces. Trainers see students;
admins also see accounts. Same `Trainer.role` (`trainer | admin`) gates the difference.

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
| Validation / DTOs | Zod (local `ZodDto` factory — no `nestjs-zod`) | **4.x** |
| OpenAPI | `@nestjs/swagger` (feeds frontend type-gen) | current |
| ORM | Prisma (+ `@prisma/adapter-pg`) | **7.x** |
| Migrations | Prisma Migrate | (Prisma 7) |
| Config | `@nestjs/config` + Zod-validated env | — |
| Logging | `nestjs-pino` (pino, structured JSON) | current |
| Database | PostgreSQL | **17** (18 fine) |
| Object storage SDK | `@aws-sdk/client-s3` (+ `@aws-sdk/s3-request-presigner`) — per-user prefixes, presigned URLs | v3 |
| LLM | `@anthropic-ai/sdk` (structured output via a forced tool over Zod-derived JSON Schema) | current |
| Scheduling | `ts-fsrs` (SM-2 fallback) | current |
| Tests | Vitest (Jest = Nest default alternative) | current |
| Lint / format / types | ESLint + Prettier · `tsc` | — |
| **Hosting (compute)** | Small AWS EC2 instance (Graviton, systemd — no container) | — |
| **Hosting (DB)** | PostgreSQL **self-hosted on the EC2 box** (beta; managed RDS is the full-prod target, §7) | PG 17 |
| **Hosting (objects)** | Amazon S3 | — |
| **Secrets** | AWS SSM Parameter Store (SecureString), fetched at boot | — |
| **Login email** | Amazon SES (IAM-role auth) | — |
| **Region** | Frankfurt (eu-central-1) — single region in beta (eu-west-1 is the full-prod DR target) | — |

**Backend-language decision (deliberate, revisitable):** **TypeScript/NestJS** is chosen for **one language
across both repos** — shared types, shared tooling, one mental model for a solo dev, and the ability to reuse
the same **Zod** schemas for API validation *and* Claude structured outputs (forced-tool JSON Schema). NestJS gives
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
  contract/               # the Zod contract source: exercise.ts · models.ts · skills.ts · staff.ts
  common/
    guards/               # JwtAuthGuard (family) · StaffAuthGuard + StaffAdminGuard (staff, §1a)
    filters/              # all-exceptions filter → the §5 error envelope
    interceptors/         # ZodResponseInterceptor (2xx bodies validated against the published schema)
    decorators/  exceptions/  pipes/   # CurrentAccount/CurrentTrainer · ApiException · ZodValidationPipe
  content/                # the §I content pipeline: loader · validate · import-plan (used by scripts/)
  modules/                # one folder per resource: controller (HTTP) + service + Zod DTOs
    auth/  profiles/  sessions/  attempts/  progress/
    chat/  homework/  assignments/  digest/ (internal module, no route)  health/
    staff/                # STAFF realm (§1a): trainer auth, review queue + authoritative apply,
                          #   lectures browse/assign, learner activity, admin user administration
  services/               # DOMAIN logic only — plain injectables (two documented exceptions carry a
                          #   tiny controller: storage/ local image endpoint · email/ e2e code readback)
    digest/               # derived markdown performance digest (internal, LLM-facing)
    fsrs/                 # scheduling (ts-fsrs)
    llm/                  # provider abstraction (Anthropic-direct + dev stub), structured output
    storage/              # S3 presigned URLs / local-FS dev store (+ local image endpoint)
    email/                # login-code delivery (console | ses | resend | capture)
fixtures/                 # the backend's committed copy of the golden session/units fixtures
prisma/
  schema.prisma           # the model truth (account, profile, item_bank, lecture, attempt, …);
                           # the word-list model is a §F slot (HISTORY.md pivot log)
  seed.ts                 # idempotent loader: staff admins + dev accounts
scripts/
  export-openapi.ts  seed-e2e.ts  llm-smoke.ts  content-validate.ts  content-import.ts
# Tests are colocated *.spec.ts under src/ (incl. the digest.md golden + the Exercise-JSON fixture gate)
package.json  package-lock.json  tsconfig.json  eslint.config.mjs  .env.example  AGENTS.md
```

### Frontend `-web`
```
src/
  main.tsx  App.tsx       # QueryClient config lives inline in main.tsx
  lib/
    api.ts                # typed fetch client — mirrors backend/SPEC.md §6 EXACTLY
    api.gen.ts            # generated from the backend OpenAPI (npm run gen:api), committed
    types.ts              # ergonomic aliases over api.gen.ts — the Exercise union lives here
    telemetry.ts          # attempt timing + emit + offline queue (frontend SPEC §4)
  app/                    # shell, routing, update prompt, tabs (lernen | erfolge | chat | profil)
  features/
    exercises/            # renderers + scaffolding (a single `placeholder` type until §F lands the
                          # new types) + audio.ts (audio_url playback + Web Speech fallback)
    assignments/  auth/  lessons/  onboarding/  profile/  progress/  sessions/  settings/  units/
                          # homework upload lives in the Chat tab; no billing/ — the app is free
  components/ui/          # shadcn components (@theme tokens live in index.css)
public/                   # PWA icons (SVG), manifest, brand svgs (nepo.svg)
monster-pets/             # served mascot SVGs (base + moods/poses), symlinked into public/monster-pets
                          #   (master source art + catalog live at repo-root assets/ — see § Media)
index.html  vite.config.ts  package.json  package-lock.json  .env.example  AGENTS.md
```

### Trainer `-trainer` (internal staff portal)
```
src/
  main.tsx  App.tsx        # providers + routes: /login, /login/code, /queue, /review/:uploadId,
                           # /history/:uploadId, /lectures, /lectures/:lectureId, /students,
                           # /students/:profileId, /students/:profileId/sessions/:sessionId,
                           # /users, /profile
  index.css               # neutral staff @theme tokens (teal accent, slate surface) — no PWA, no mascots
  app/AppLayout.tsx       # top bar: (b) brand + trainer name, nav with live count badges, logout
  lib/
    api.ts                # transport only over the STAFF routes — staff cookie, error-envelope → ApiError
    api.gen.ts            # GENERATED from the backend OpenAPI (`npm run gen:api`), committed, never edited
    contract.ts           # ergonomic aliases over the generated `operations` (no hand-authored shapes)
    endpoints.ts          # typed wrappers: staffAuthApi, reviewApi, studentsApi, lecturesApi, usersApi
  features/
    auth/                 # StaffAuthProvider, /staff/me probe, RequireStaff guard, login + code screens
    queue/                # review list (Offen | Erledigt | Alle) — rows by student name (§H1.3)
    review/               # image + LLM draft SIDE BY SIDE; approve | correct | reject (+ AnalysisEditor);
                          #   read-only history detail for decided items
    students/             # learner directory + assignments + activity timeline + session drill-down (§H1.3/§H3)
    lectures/             # teaching console: content-library browse + assign + outcome table (§H1/§I3;
                          #   lectures are authored in repo-root content/, never here)
    users/                # ADMIN: account approval / deactivate / delete + per-student progress
    profile/              # the trainer's OWN profile (rename self; email/role admin-provisioned)
    progress/             # shared learner-progress panel (summary · skills · activity)
  components/ui/          # button, input, select, textarea, modal, filter-chips, image-lightbox
index.html  vite.config.ts  package.json  .env.example  README.md  AGENTS.md  SPEC.md
```
The trainer portal is **transport + UI only** — every decision (queue ordering, authoritative apply, who may
review) is enforced by the backend `staff/` module. It ships to ~3 internal staff, never to families, and
authenticates on the disjoint **staff** realm (§1a). **Form factor: desktop/tablet, landscape two-pane** (image
| LLM draft) — **not** mobile-first; skip phone layouts (that's the family app's job, §11). Types are generated
from the backend's **full** published OpenAPI (`npm run gen:api`; the portal calls only `/staff/*`, but any
contract change — family routes included — requires the regen) and drift-gated in CI.

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
  a `/me` probe, so a refresh never logs the student out. `JwtAuthGuard` also accepts `Authorization: Bearer <jwt>`
  for non-browser/API clients. (Refresh-token rotation is deferred; the 30-day cookie is the v1 posture.)
  There is no PIN or parent-elevation step — destructive profile routes are plain family-session
  routes, ownership-checked and double-confirmed in the UI (backend SPEC §4).
- **CSRF posture:** there is no CSRF token — protection rests entirely on `SameSite=Lax` (so a genuinely
  cross-site `evil.com` POST carries no cookie) plus the explicit production CORS allowlist (the backend
  refuses to boot without one). This is adequate for beta because the apps and API are subdomains of one
  registrable domain. **Caveat to keep in mind:** SameSite=Lax treats all same-site subdomains as trusted,
  so an XSS or takeover on *any* sibling subdomain (e.g. the marketing site on the apex) is same-site and
  could ride the family cookie. A per-request CSRF token is the post-beta hardening if that surface grows.
- **Naming:** resource nouns, plural, kebab-free snake in JSON bodies is *not* used — **JSON uses camelCase**,
  DB columns use snake_case; the backend maps between them. Pick one and never mix on the wire: **camelCase wins.**
- **Status codes:** `200` ok · `201` created · `204` no body · `400` malformed · `401` unauthenticated ·
  `403` authenticated-but-forbidden · `404` · `409` conflict ·
  `422` validation · `429` rate-limited · `5xx` server.
- **Idempotency:** `POST /attempts` must be idempotent (dedupe on `(session_id, item_id, attempt_no)`).
- **Correlation:** the backend assigns an `X-Request-Id` per request (or echoes the client's). It appears in
  every log line and in error envelopes. The frontend generates one per user action and sends it.
- **Pagination:** cursor-based where lists can grow (`?limit=&cursor=`); responses carry `nextCursor`.
- **Rate limits:** auth-code request/verify are strictly limited (SPEC §4). Gated AI
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
  api.gen.ts     (committed, frontend + trainer)  # generated via `npm run gen:api` in EACH SPA — NEVER hand-edit
     │
     ▼
  CI drift gate: re-run gen:api && git diff --exit-code  →  red on any drift
  ```

  The same Zod schemas drive Claude structured output (a forced tool over their JSON Schema), so Exercise JSON stays typed
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
    "code": "VALIDATION_ERROR",
    "message": "Human-readable, safe to surface in the family app.",
    "requestId": "req_8f3a…",
    "details": [ { "field": "code", "issue": "expired" } ]
  }
}
```

**Error code catalog (stable strings the frontend switches on — never parse `message`):**

| HTTP | `code` | Frontend behaviour |
|---|---|---|
| 401 | `UNAUTHENTICATED` / `SESSION_EXPIRED` | route to `/login`, show "Sitzung abgelaufen" |
| 403 | `FORBIDDEN` | generic "not allowed" |
| 422 | `VALIDATION_ERROR` | field-level messages from `details[]` |
| 429 | `RATE_LIMITED` | back off using `Retry-After` (set by the IP limiter AND app-thrown caps); soft message |
| 403 | `ACCOUNT_INACTIVE` | deactivated/deleted account — treat like a 401, route to `/login` |
| 404 | `NOT_FOUND` / `NO_ITEMS` | `NO_ITEMS` = bank empty for the unit (pre-§F state) |
| 409 | `CONFLICT` / `ALREADY_COMPLETED` / `LECTURE_NOT_PUBLISHED` | — |
| 503 | `PROVIDER_UNAVAILABLE` | AI unavailable OR twice-unusable output; family app falls back to a bank session |
| 500 | `INTERNAL` | generic apology + `requestId`; nothing technical |

**Backend rules**
- All exceptions funnel through the all-exceptions filter in `common/filters/` that emits the envelope above. No raw stack
  traces, ORM errors, or provider errors ever reach the client — they're logged with the `requestId` and
  replaced by `INTERNAL`.
- Zod validation failures (via the local `ZodValidationPipe`) are reshaped into `VALIDATION_ERROR` with a `details[]` array (field + issue).
- **Never leak** which emails exist (`/auth/request-code` always `200`), or any other
  account-enumeration signal.
- Expensive AI ops wrap provider failures: on an Anthropic error, return `503 PROVIDER_UNAVAILABLE`.

**Frontend rules**
- A single error interceptor in `api.ts` maps `code → action` per the table; components don't hand-roll
  error parsing.
- `401/SESSION_EXPIRED` clears auth state and redirects once (no loops).
- Telemetry (`POST /attempts`) failures are swallowed and queued (PWA offline queue), never surfaced to a
  student mid-exercise.
- Always show `requestId` on a hard error so a parent can quote it in support.

**Retries:** idempotent GETs and `POST /attempts` retry with exponential backoff + jitter (max ~3). Never
auto-retry non-idempotent POSTs (checkout, homework upload, chat send).

---

## 6. Logging agreement

**Structured JSON, one event per line, machine-parseable.** Backend uses `nestjs-pino` (pino); frontend uses a thin
wrapper over `console` (optionally shipping warn/error to Sentry).

**Every backend log line carries:** `timestamp`, `level`, `event`, `requestId`, `accountId` (if authed),
`route`, `latencyMs`, `status`. Never the `profileId` of a student alongside content.

**Levels**
- `DEBUG` — local only; never enabled in prod.
- `INFO` — request completed, session generated (counts, source), webhook processed, migration ran, homework
  review actioned (`{event:"homework.reviewed","trainerId":"…","uploadId":"…","decision":"corrected","agreedWithLlm":false}` — ids + outcome, never the analysis content).
- `WARNING` — rate-limit hit, credit exhausted, provider slow/retried, login-code lockout, staff-auth failure.
- `ERROR` — unhandled exception (with `requestId`), provider failure, webhook signature mismatch.

**NEVER log (this is an app for minors — treat it as the hard line):**
- The contents of exercises a student answered, their answers, or homework image contents / OCR text.
- Email addresses, the 4-digit login code, JWTs, cookies, presigned storage URLs.
- Full request/response bodies. Payment tokens or provider secrets.
- Any field that, combined, re-identifies a specific student's performance.

Log **identifiers and outcomes, not payloads**: `{"event":"session.generated","accountId":"…","source":"bank","items":8}` — never the items themselves.

**Telemetry vs logs are different systems.** Learning telemetry (the `attempt` rows) is **product data** in
Postgres, governed by the SPECs and consent — it is *not* operational logging and must never be duplicated
into the log stream. Logs are for running the service; they are short-retention and contain no learning content.

**Destinations & retention:** stdout JSON → platform log aggregator. Operational logs retained ~30 days.
Errors optionally mirrored to Sentry (scrub PII in `beforeSend`). Raw homework images: short retention per
SPEC §10, deleted on a schedule, EU residency.

---

## 7. Build · update · distribution

**Hosting: AWS**, region **Frankfurt (eu-central-1)** — data at rest in the EU (AWS has no Austria
region; Frankfurt is the closest EU location). The environment is authored in `infra/` (Terraform) +
`deploy/` (on-box scripts) and sized for the **€50/mo all-in beta budget** (HISTORY.md §E). *Local
dev needs none of it.*

### Backend (the live beta stack)
- **Compute:** one **small EC2 instance** (t4g Graviton), running `node dist/main.js` under **systemd** —
  no container, no registry. TLS via **nginx + Let's Encrypt** (no ALB — a single box needs neither its
  load-balancing nor its health checks).
- **Database:** **PostgreSQL self-hosted on the same box** (EBS data volume, 5432 never exposed), with the
  off-platform encrypted `pg_dump` below as its safety net.
- **Objects:** **Amazon S3**, one bucket, per-user prefixes (`users/{account}/{profile}/…`), access via
  short-lived **presigned URLs** scoped to a single object; the app authenticates via the **IAM instance
  role** (default credential chain — no keys in env). Lifecycle policy auto-deletes raw homework images on
  schedule.
- **Secrets:** **SSM Parameter Store (SecureString)**, rendered to a root-only systemd `EnvironmentFile`
  at deploy; nothing in the repo or on disk.
- **Deploys:** GitHub Actions via **OIDC → a scoped IAM role → SSM Run Command** (no static AWS keys, no
  inbound SSH); manual `workflow_dispatch` only — merging never auto-deploys.
- **Health:** `GET /api/v1/health` → `{status, version, commit}` for the uptime probe.
- **Migrations:** `prisma migrate deploy` runs as a **pre-traffic release step** (never at app startup).
  Forward-only, expand→migrate→contract so rollouts are zero-downtime and rollback-safe.
- **Seed + content:** release order is `migrate deploy → seed → content:import → restart`. `npm run seed`
  is idempotent (staff admins + dev accounts); `npm run content:import` (§I2) is the versioned, idempotent
  import of the `content/` lecture library — invalid content aborts the deploy (CI's `content` job is the
  first line of defense).

**Deferred to full production** (the graduation targets, in ROADMAP's Deferred list): managed **RDS** +
cross-region DR snapshot copy (eu-west-1) · multi-instance + **ALB**/blue-green · the **OpenTelemetry**
collector/exporter build-out (OTel is the chosen approach; beta ships an uptime ping only) · **staff MFA**
(email-code-only is a conscious beta exception, ~3 admin-seeded trainers).

### Backups & off-platform disaster recovery
The in-AWS cross-region backup above survives a *regional* incident, but **not** an account-level event — a
billing dispute or policy flag can suspend the account and take compute, database, **and** objects offline
simultaneously. The cheap insurance is to keep an independent copy **outside AWS**, so an account problem
costs uptime, not data and users.

- **Postgres:** scheduled `pg_dump` (daily; a cron on the instance or GitHub Actions) → compressed,
  **client-side encrypted** (age/gpg) → pushed to a **different provider** (e.g. Cloudflare R2, Backblaze B2,
  or another cloud's object storage). Keep the in-AWS automated backups too; this is the off-platform tier.
- **Objects:** periodic export of the user prefixes (`users/{account}/{profile}/…` — homework images,
  generated sessions/digests) to the same off-platform target, encrypted; student homework + learning
  artifacts are the priority.
- **Retention:** short rolling window (e.g. 7 daily + 4 weekly), aligned with the minors'-data retention
  posture in §8 — backups are not an excuse to keep student data forever; expire them on the same clock.
- **Encryption & access:** the off-platform copy is encrypted with a key **not stored in SSM/AWS**
  (otherwise an account freeze locks you out of your own backups). Hold that key separately.
- **Restore drills:** a backup you haven't restored is a hope, not a backup. Periodically rebuild Postgres from
  a dump into a throwaway instance and verify row counts + a sample profile. Document the restore runbook.
- **Scope:** this is **disaster recovery, not analytics** — encrypted archives, not a queryable mirror, and
  subject to the same "no student content in logs/exports we don't need" discipline as everything else.

Result: an AWS account suspension becomes a recoverable outage (stand the app + DB back up elsewhere,
restore from the off-platform dumps) rather than the loss of every family's data.

### Frontend
- **Build:** `vite build` → hashed, immutable static assets + `index.html`.
- **Distribution:** **S3 + CloudFront** (both frontends; the trainer portal on its own origin). Cache policy:
  hashed assets `immutable, max-age=1y`; `index.html` + service worker `no-cache` so deploys are picked up
  immediately.
- **PWA update strategy (important):** vite-plugin-pwa + Workbox, **prompt-to-update** (never silent reload
  mid-lesson). On new SW detected → let the current exercise finish, then a gentle "Neue Version verfügbar –
  neu laden?" in the shell, never interrupting a student's answer. App shell precached → installable
  and offline-capable.
- **Offline:** the attempt queue (frontend SPEC §4) is an app-level localStorage FIFO in
  `lib/telemetry.ts` that flushes on the `online` event (not Workbox background sync — the queue
  survives reloads and stays inspectable). Workbox handles static precache + read-only API caching.

### Versioning & releases
- **SemVer per repo.** Version + commit injected at build (`VITE_APP_VERSION` / backend `version`) and shown
  in `/health` and the Profil tab — a pattern borrowed from dtctl's `ldflags` version stamping.
- **The API version (`/v1`) is the cross-repo contract** and moves independently of repo SemVer.
- Tag releases; `CHANGELOG.md` per repo. A frontend deploy must never assume an unreleased backend route.

### CI/CD (GitHub Actions)
- Implemented in `.github/workflows/ci.yml` (monorepo: one workflow with `backend`, `frontend`, and
  `trainer` jobs; on push to `main` + all PRs). The top-level Playwright suite (`e2e/`) is **run locally
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
  path from the client); routes are gated by **account status (approved/active, §1b)**
  (entitlement/credit gating is deferred, §9); login codes are hashed and rate-limited. Destructive
  profile routes are ownership-checked and double-confirmed in the UI (no PIN).
- **No in-memory security state in prod.** Anything that gates access — lockout counters, rate-limit
  windows — lives in a durable store (DB columns / Redis), never a process-local Map. A restart or a second
  replica must never reset a lockout (a brute-force hole). The login-code lockout (5 fails) is persisted
  on `login_code.attempts`.
- **LLM access is abstracted.** AI work (free, but access-gated by account status) goes through a single
  swappable `LlmService` (Anthropic-direct is the default) so the provider could move (e.g. Bedrock /
  Vertex EU) without touching callers. **EU data-residency for minors is a hard gate before any production LLM
  call** — see the data-flow options below.
- **Staff access to minors' data (trainers).** Homework review (§11) means internal staff see a student's
  homework photo — the strongest minors'-data exposure in the system. Gate it hard: (a) trainers are a small,
  **vetted, DPA-bound** staff pool with named accounts (MFA at full prod, §7), never anonymous; (b) trainer surfaces are
  **minimised** — student name + learning data + image + LLM draft, never parent email/chat/billing (§1a); (c)
  every trainer action (claim, approve, correct, reject) is **audit-logged** with the staff id and upload id
  (identifiers + outcome, never image/answer content — §6); (d) consent copy at upload states that a homework
  photo is reviewed by a trained professional to tailor lessons; (e) raw images expire on the §7 lifecycle
  regardless of review state. A trainer is revoked by flipping their status (seed/DB — a self-serve
  admin surface for this is deferred); the staff guard re-checks status per request, so revocation is
  immediate, and any live queue claim simply expires with its short lease. (Trainers leaving a review
  without a verdict do release explicitly — `POST /staff/queue/{id}/release`; revocation just doesn't
  need it.)
- **Minors' data:** primary region **Frankfurt (eu-central-1)** keeps data at rest in the EU; DR backups stay
  within the EU (eu-west-1). Explicit parent consent for homework images; short retention via the S3 lifecycle;
  the logging rules in §6 are part of this commitment. **LLM data-flow (decided):**
  1. **Anthropic API direct (chosen).** Simplest path and always the newest models. For EU inference
     residency, set `INFERENCE_GEO=eu` (→ `inference_geo` on every call) **once EU routing is enabled
     on the Anthropic org** — the allowed values are an org capability, and without it `eu` 400s every
     call (bitten 2026-08-09; the env default omits the parameter until the org supports it). It's an
     external seam: keep a **DPA**, send the *digest* (not raw student identifiers) where possible, and
     document the data flow.
  2. **Claude via Bedrock or Vertex AI (EU regions).** Fallback escape hatches only if a strictly
     cloud-internal data boundary is ever required — at the cost of feature lag (no same-day models,
     missing platform features) and a heavier integration.
  Whichever is used, the same rules hold: **DPA in place, send the digest not raw identifiers where possible,
  and document the data flow.** TTS (Amazon Polly, deferred) follows the same DPA + minimal-data discipline.
  - **Model policy (Anthropic-direct default):** `ANTHROPIC_MODEL` = `claude-sonnet-5` (generation/chat),
    `ANTHROPIC_VISION_MODEL` = `claude-opus-4-8` (homework OCR — accuracy-critical). On current models
    `temperature`/`top_p`/`top_k` are rejected (400): steer with the prompt (and output effort), not sampling
    params. Stable system prompts are sent as prompt-cacheable blocks. Structured output is a forced tool over
    the `src/contract` Zod→JSON-Schema, re-validated (incl. solvability) with a one-shot re-ask on a miss.
- **Observability:** `requestId` threads request → logs → error envelope → support. Optional Sentry on both
  ends with PII scrubbing. Health checks drive systemd/uptime-monitor restarts.

---

## 9. Payments — **DEFERRED (not built; the app is free)**

The app is **free, including the AI features**; access is gated by staff approval (§1b). There is **no**
billing module, checkout, webhook, entitlement/credit enforcement, or billing UI anywhere, and no billing
tables in the schema (re-add by migration if metering is ever introduced). `★` on an endpoint just marks an
"AI-backed / cost-bearing op" — free for any approved, active account. If metering ever becomes a milestone:
use a Merchant of Record (card data never touches the backend, EU VAT handled), parent-facing only, and
never lives/energy/loot mechanics.

---

## 10. Media & image handling — **SVG-first**

**Policy: every app-authored or generated visual is SVG.** Mascots (Nepo/Stella), the "b" logo mark, badges,
reward art, exercise illustrations, icons, decorative elements — all SVG. Rationale that matters *for this app*:

- **DPI-independent** — crisp on every phone/tablet a student might use, no `@2x/@3x` asset sets.
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
  if you want identical rendering across devices — a real concern when a letter's *Anlaut* depends on the student
  recognising the picture.

**The one unavoidable raster exception: homework photos.** A camera photo of a worksheet is inherently raster
and must **not** be faked into SVG. Handle it as the deliberate exception:
- Accept **WebP/JPEG/PNG**; transcode to **WebP** for storage (smaller), keep one original for re-analysis.
- **Strip EXIF on upload** — phone photos embed GPS/time; for a student's image that metadata is a privacy
  hazard and must be removed server-side before the blob is persisted.
- Downscale to a sane max dimension before sending to the vision model (cost + speed); store under the user
  prefix with the lifecycle auto-delete from §7.
- The *output* of vision analysis is structured JSON / markdown (§ SPEC §10), not an image — so everything
  downstream of the photo is back to text/SVG.

---

## 11. Homework review — professional-in-the-loop (authoritative human gate)

Student handwriting OCR is unreliable and the stakes (shaping a struggling student's lessons) are high, so a
homework photo's LLM analysis is **never** applied on its own. A vetted **internal literacy professional**
(staff trainer, §1a) validates it first. The trainer's verdict is **authoritative** and **replaces** the
former parent-confirm step. The flow is **asynchronous** — the student is never blocked.

**Teaching-console extension (§H/§I):** the portal is not review-only — and it does not author either.
Lectures (Merksatz + solvability-gated exercises) are written by the **linguist (Angelika)** as
markdown in the repo's `content/` directory (Claude Code sessions → PRs, §1a) and
imported versioned at deploy (§I2, `item_bank` rows with `generated_by='content'`). Trainers **browse**
the library and **assign** lectures to specific students; the assignment pins the lecture version it
was created against and appears on `/lernen` as a personal offer ("Übung von {Trainer}", never a
push), plays as an ordinary session (`source='assigned'` — attempts feed FSRS/digest like any other),
and the outcome lands back in the trainer's assignment table (spanning all versions of a lecture) and
the per-question drill-down. The digest's "Zugewiesene Übungen" section closes the loop so
LLM-generated lectures build on the assigned material (backend SPEC §3/§6/§8).

```
family uploads photo (Chat tab) ─▶  backend: strip EXIF, →WebP, store under user prefix
        │                                          status = pending_analysis
        ▼
Claude vision (★, gated)  ──▶  llm_analysis (DRAFT, NOT applied)   status = pending_review
        │                                          ▼  enqueued to the shared review queue
        ▼
TRAINER-PORTAL (-trainer):   trainer pulls next item, sees image + LLM draft SIDE BY SIDE,
        approves as-is │ corrects fields │ rejects (unreadable / not homework)
        │                                          status = reviewed | rejected
        ▼
backend applies the REVIEWED analysis (authoritative) ──▶ derived attempt rows + review_state
        │   records llm-vs-trainer diff (LLM-quality signal)
        ▼
next generated lecture (§ SPEC §9) consumes the validated focus skills;
the family chat shows the verdict as a status bubble (informational, non-blocking)
```

**Invariants (non-negotiable):**
- **Nothing mutates the learning profile before a trainer verdict.** `llm_analysis` is a draft; only the
  `reviewed_analysis` writes `attempt`/`review_state`. (Replaces the old "before parent confirm" rule.)
- **The LLM draft and the trainer's correction are both retained** as an append-only review record, with an
  `agreed_with_llm` flag — this is how we measure and improve vision quality over time ("compare against the
  LLM response"). It is product/QA data, governed like learning telemetry (§6), never operational logging.
- **The trainer sees the student's name + learning data, minimised** (§1a, known-trainer model): image +
  draft + skill tags + grade band + activity, never the parent email, chat, or billing.
- **Async, never blocking:** review latency lands in the *next* lecture, not the current lesson. A pending or
  rejected upload simply means the next lecture isn't yet homework-informed.
- **Rejected** uploads (unreadable, not homework, or contains unexpected personal data) mutate nothing and are
  deleted on the raster-retention schedule (§7).

The trainer portal is a thin client over backend endpoints (`backend/SPEC.md §6` staff routes); it holds no
business logic. Trainer auth, queue claiming (to avoid double-review), and the authoritative-apply step all
live in the backend.

**Scale & form factor (deliberately small):** the staff pool is **~3 trainers** in v1 — a tiny, fixed,
hand-provisioned set (no self-signup; an admin seeds the `trainer` rows). Design accordingly: the queue and
claim-lease exist to stop *two* people grabbing the same item, not to load-balance hundreds; throughput is
not a concern, correctness and auditability are. The portal targets **desktop/laptop and tablet** (staff want
room to see the homework photo and the LLM draft side by side) — it is **not** optimised for phones. Build the
review screen as a two-pane **landscape** layout (image | draft) with comfortable tap targets for tablet; a
narrow-phone layout is explicitly out of scope (the family `-web` app is the mobile-first one, not this).

---

## 12. The improvement cycle — telemetry → adaptation → content quality

The product's core claim is adaptivity, so the feedback loops are the architecture's spine. Four loops
are **built** (all flowing telemetry *forward* into what one student gets next); a fifth — the
**content-quality loop** — is planned (ROADMAP §J) and closes the cycle back to the content authors.

**Built (student-indexed):**

1. **Answer → memory model.** Every answered exercise emits exactly one `attempt` row (`time_ms`,
   `attempt_no`, `item_id`, `skill_tags`; SPEC §4). Each attempt immediately updates `review_state`
   per `(profile, skill_tag)` via FSRS — wrong = Again, correct-after-retry = Hard, first-try = Good.
   FSRS is scheduled **per skill, not per word** — the skill-tag taxonomy is the durable spine.
2. **Weak/due → bank session.** Deterministic selection (backend SPEC §8A): a skill is *weak* below
   70 % first-try correct or above 15 s average over the last 14 days; due skills come from FSRS.
   Items are ranked by priority-skill overlap. Zero LLM calls; LLM-generated items matching the
   priority skills join the pool, so one student's generated content benefits all.
3. **Focus + digest → generated lecture (★).** The LLM path (SPEC §8B) assembles weak ∪ due ∪
   trainer-reviewed homework focus, renders `digest.md` (per-skill 14-day table with correct %, avg
   time, trend; recent wrong answers; FSRS-due; recent assigned-lecture outcomes) into the prompt,
   and every generated exercise passes `solvableExerciseSchema` before persisting. The database
   decides *what* to drill; the LLM only writes content.
4. **Human loops.** Homework: the trainer's authoritative verdict schedules its focus skills as
   failed FSRS reviews (§11). Teaching console: trainers review per-student activity down to each
   question's answer/retries/timing (§H3) and assign the next content-library lecture; assignment
   outcomes feed back into the digest.

**Planned — the content-quality loop (ROADMAP §J):** everything above is **student-indexed**; no
read model aggregates by *content*. §I deliberately created the durable content anchors — lecture
`slug`, exercise lineage `{slug}.{exId}` (stable across versions via content-addressed `item_bank`
rows) — precisely so telemetry can answer *"which lecture/exercise underperforms across students,
and did v2 beat v1?"*. §J builds one shared content-analytics read model (per item lineage /
exercise type / slug / version: attempts, first-try correct %, avg time, retry + abandon rates, with
a **minimum-N floor** baked in) and two consumers: a trainer-portal „Content-Qualität" screen, and
an **anonymized stats report exported into the repo** for the content-authoring role (§1a). Repo
access sits outside the staff DPA, so the report may only ever contain content-indexed aggregates —
never a name, profileId, or per-student row. (Angelika, also a trainer, can additionally read the
portal screen; the repo report is the authoring-role channel and must stay safe on its own.)

**Scaling invariants (hold these as types/lectures/telemetry grow):**
- **Two durable keys, nothing else.** Skill tags (`contract/skills.ts`, guarded by
  `content/skills.lock.json`) link telemetry to *pedagogy*; `{slug}.{exId}` links it to *content*.
  Everything downstream keys on one of these two opaque strings — renaming either orphans history.
- **The digest is size-capped** (ROADMAP §J1): top-N weakest skills, capped due-list and attempt
  fetch — the LLM prompt must not grow with the taxonomy or a student's history.
- **Every read surface is either student-indexed or content-indexed, never both.** The per-student
  surfaces stay inside the staff/family realms; the content-indexed §J aggregates are the only
  telemetry that may leave them (into the repo report), and only above the minimum-N floor.
- **Timing data must be read as robust, not raw** (ROADMAP §J5): `time_ms` runs from item mount to
  answer, so backgrounded tabs inflate it — the frontend pauses the timer on visibility loss and
  every aggregation (weak-skill heuristic, digest, §J analytics) winsorizes. Capture stays minimal
  on principle: answer content and coarse interaction counts (audio replays, retries), never
  keystrokes, traces, or fingerprints — the restraint is what keeps the §J4 repo report safe.
