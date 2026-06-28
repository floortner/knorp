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
│  Vite + React SPA / PWA │   Bearer (httpOnly cookie)    │  NestJS · Azure          │
│  static, Azure CDN/SWA  │ ◀───────────────────────────  │  Container Apps          │
└─────────────────────────┘                               └───────────┬─────────────┘
                                  Azure (Austria East / Switzerland N) │
              ┌───────────────────────┬──────────────────┬────────────┼───────────────┐
              ▼                       ▼                  ▼            ▼               ▼
   Azure DB for PostgreSQL    Azure Blob Storage    Anthropic API  Neural TTS   Merchant of Record
   (Flexible Server)          (per-user, SAS URLs)  (sessions/      (de-AT/      (Lemon Squeezy/
                                                     chat/vision)    de-DE)       Paddle) — hosted
                                                                                  checkout, webhook
```

- **Two repos, deployed independently.** The frontend is a static artifact; the backend is a container.
  *Current reality:* both live in **one monorepo** (`besserlesenschreiben/{backend,frontend}`) for fast
  cross-cutting iteration during Phase 1/1.5. They are kept independently buildable/deployable (separate
  `package.json`, CI jobs, env) and split into the `-api`/`-web` repos before public launch — the contract
  pipeline (§4) is what makes that split a non-event.
- **The boundary is the HTTP API contract** (`backend/SPEC.md §6`). Neither side reaches across it: the
  frontend holds no DB/business logic; the backend serves no HTML.
- Claude Design iterates on the screens; it changes how exercises *look*, never the data flow.

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
| Object storage SDK | `@azure/storage-blob` (+ `@azure/identity`) — per-user prefixes, SAS URLs | current |
| Secrets SDK | `@azure/keyvault-secrets` | current |
| LLM | `@anthropic-ai/sdk` (structured output via `zodOutputFormat`) | current |
| Scheduling | `ts-fsrs` (SM-2 fallback) | current |
| Tests | Vitest (Jest = Nest default alternative) | current |
| Lint / format / types | ESLint + Prettier · `tsc` | — |
| **Hosting (compute)** | Azure Container Apps (scale-to-zero) | — |
| **Hosting (DB)** | Azure Database for PostgreSQL Flexible Server | PG 17 |
| **Hosting (blobs)** | Azure Blob Storage | — |
| **Secrets** | Azure Key Vault | — |
| **Login email** | Azure Communication Services Email (or Resend/Postmark) | — |
| **Region** | Austria East (Vienna) primary · Switzerland North fallback | — |

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
    guards/               # JwtAuthGuard · ParentScopeGuard · EntitlementGuard
    filters/              # all-exceptions filter → the §5 error envelope
    interceptors/         # requestId + logging
    security/             # JWT, argon2 PIN hashing, rate limiting
  modules/                # one folder per resource: controller (HTTP) + service + Zod DTOs
    auth/  profiles/  sessions/  attempts/  progress/
    chat/  homework/  parent/  billing/
  services/               # DOMAIN logic only — plain injectables, NO controllers/HTTP here (dtctl lesson)
    sessions.service.ts   # bank + LLM session generation (SPEC §8)
    fsrs.service.ts       # scheduling (ts-fsrs)
    digest.service.ts     # derived markdown performance digest
    tts.service.ts  vision.service.ts  storage.service.ts  media.service.ts  email.service.ts
prisma/
  schema.prisma           # the model truth (account, profile, item_bank, attempt, …)
  seed.ts                 # item-bank seed loader (prisma db seed)
scripts/
  build-seed.ts           # regenerates item_bank.seed.json from source
item_bank.seed.json
test/                     # Vitest; incl. golden snapshots for digest.md + Exercise JSON
Dockerfile  package.json  package-lock.json  tsconfig.json  eslint.config.mjs  .env.example  AGENTS.md
```

### Frontend `-web`
```
src/
  main.tsx  App.tsx
  lib/
    api.ts                # typed fetch client — mirrors backend/SPEC.md §6 EXACTLY
    queryClient.ts        # TanStack Query config
    audio.ts              # audio_url playback + Web Speech fallback
    telemetry.ts          # attempt timing + emit (frontend SPEC §4)
  routes/                 # login, onboarding, app(lernen|liga|profil|chat), parent
  features/
    exercises/            # the 12 renderers + the Exercise union type
    progress/  chat/  parent/  billing/
  components/ui/          # shadcn components
  hooks/  styles/theme.css (@theme tokens)
public/                   # PWA icons (SVG), manifest
assets/svg/               # app illustrations, mascots (Nepo/Stella), badges — all SVG (§ Media)
index.html  vite.config.ts  package.json  package-lock.json  .env.example  AGENTS.md
```

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
  `402` payment required (no credits / tier) · `422` validation · `429` rate-limited · `5xx` server.
- **Idempotency:** `POST /attempts` and `POST /billing/webhook` must be idempotent. Attempts dedupe on
  `(session_id, item_id, attempt_no)`; webhooks on the provider event id.
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
| 402 | `INSUFFICIENT_CREDITS` / `TIER_REQUIRED` | route **parent** to supporter screen (never child) |
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
- `INFO` — request completed, session generated (counts, source), webhook processed, migration ran.
- `WARNING` — rate-limit hit, credit exhausted, provider slow/retried, PIN lockout.
- `ERROR` — unhandled exception (with `requestId`), provider failure, webhook signature mismatch.

**NEVER log (this is a children's app — treat it as the hard line):**
- The contents of exercises a child answered, their answers, or homework image contents / OCR text.
- Email addresses, the 4-digit login code, the parent PIN (or its hash), JWTs, cookies, Blob SAS URLs.
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

**Hosting: Microsoft Azure**, region **Austria East (Vienna)** primary — data at rest in Austria, ideal for an
Austrian children's app. **Switzerland North (Zurich)** is the fallback. Austria East has **no in-country
paired region** yet, so geo-redundant DB backups replicate to **Germany West Central** (or North Europe).
New Azure services land in fresh regions gradually → **confirm every service below is GA in Austria East**
before committing; otherwise pin to Switzerland North.

### Backend
- **Compute:** **Azure Container Apps** (scale-to-zero, scales on HTTP load — fits the cost-recovery goal).
  Multi-stage `Dockerfile`, non-root, `npm ci` deps, Node 24; image in **Azure Container Registry**.
- **Database:** **Azure Database for PostgreSQL Flexible Server**, zone-redundant where the region offers it,
  geo-backup to the DR region above.
- **Blobs:** **Azure Blob Storage**, one container, per-user virtual prefixes (`users/{account}/{profile}/…`),
  access via short-lived **user-delegation SAS** scoped to the caller's prefix (the Azure equivalent of the
  signed-URL rule). Lifecycle policy auto-deletes raw homework images on schedule.
- **Secrets:** **Azure Key Vault**, referenced by Container Apps; nothing in the image or repo.
- **Health:** `GET /api/v1/health` → `{status, version, commit}` for the Container Apps probe.
- **Migrations:** `prisma migrate deploy` runs as a **pre-traffic release step** (never at import). Forward-only,
  expand→migrate→contract so rollouts are zero-downtime and rollback-safe.
- **Seed:** `npm run seed` (`prisma db seed` → `prisma/seed.ts`) is idempotent; run on first deploy and when the seed JSON changes.

### Backups & off-platform disaster recovery
The in-Azure geo-backup above survives a *regional* incident, but **not** an account-level event — a billing
dispute or policy flag can suspend the subscription and take compute, database, **and** blobs offline
simultaneously. The cheap insurance is to keep an independent copy **outside Azure**, so an account problem
costs uptime, not data and users.

- **Postgres:** scheduled `pg_dump` (daily; a Container Apps job or GitHub Actions cron) → compressed,
  **client-side encrypted** (age/gpg) → pushed to a **different provider** (e.g. Cloudflare R2, Backblaze B2,
  or another cloud's object storage). Keep the in-Azure automated backups too; this is the off-platform tier.
- **Blob:** periodic export of the user prefixes (`users/{account}/{profile}/…` — homework images, generated
  sessions/digests, TTS audio) to the same off-platform target, encrypted. TTS audio is regenerable so it's
  lowest priority; child homework + learning artifacts are the priority.
- **Retention:** short rolling window (e.g. 7 daily + 4 weekly), aligned with the minors'-data retention
  posture in §8 — backups are not an excuse to keep child data forever; expire them on the same clock.
- **Encryption & access:** the off-platform copy is encrypted with a key **not stored in Azure Key Vault**
  (otherwise an account freeze locks you out of your own backups). Hold that key separately.
- **Restore drills:** a backup you haven't restored is a hope, not a backup. Periodically rebuild Postgres from
  a dump into a throwaway instance and verify row counts + a sample profile. Document the restore runbook.
- **Scope:** this is **disaster recovery, not analytics** — encrypted archives, not a queryable mirror, and
  subject to the same "no child content in logs/exports we don't need" discipline as everything else.

Result: an Azure account suspension becomes a recoverable outage (stand the container + DB back up elsewhere,
restore from the off-platform dumps) rather than the loss of every family's data.

### Frontend
- **Build:** `vite build` → hashed, immutable static assets + `index.html`.
- **Distribution:** **Azure Static Web Apps** (or Blob + Azure CDN/Front Door). Cache policy: hashed assets
  `immutable, max-age=1y`; `index.html` + service worker `no-cache` so deploys are picked up immediately.
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
- Implemented in `.github/workflows/ci.yml` (monorepo: one workflow, a `backend` job and a `frontend` job, each
  scoped to its subdirectory; on push to `main` + all PRs). On the repo split each job moves to its own repo
  unchanged.
- Frontend: install → typecheck (`tsc`) → lint → unit + **golden** tests → `vite build` → deploy to Azure on `main`.
- Backend: `npm ci` → lint (ESLint) → typecheck (`tsc --noEmit`) → `vitest` (incl. **golden** tests) → `prisma generate` →
  build image → push to ACR → `prisma migrate deploy` + deploy to Container Apps on `main`.
- **Contract check:** regenerate `api.ts` types from the backend OpenAPI and fail the frontend build on drift.
- **Golden/snapshot tests (dtctl lesson):** the two outputs that are *contracts* — the `digest.md` format
  (LLM-facing) and the `Exercise` JSON (client-facing) — are pinned with golden files built from real structs.
  A change to either is then visible in the diff and reviewed deliberately, never silent.

---

## 8. Configuration, security & data residency (cross-cutting)

- **Config is env-only**, typed via `@nestjs/config` + a Zod env schema (backend) and `import.meta.env` (frontend). Every var
  is documented in a committed `.env.example`; **no secret is ever committed**. Secrets live in **Azure Key
  Vault**. Full var list: `backend/SPEC.md §11`.
- **Security boundary (recap, non-negotiable):** `user_id`/`profile_id` derive only from the JWT; Blob access is
  via **user-delegation SAS scoped to the caller's prefix** (never a path from the client); parent-scope +
  entitlement checks gate the routes that need them; PIN and login code are hashed and rate-limited.
- **No in-memory security state in prod.** Anything that gates access — PIN-lockout counters, rate-limit
  windows — lives in a durable store (DB columns / Redis), never a process-local Map. The backend scales to
  zero and out, so in-memory counters would reset on every cold start and never be shared across replicas
  (a brute-force hole). The parent-PIN lockout (5 fails / 15 min) is persisted on `account`
  (`pin_attempts`, `pin_locked_until`).
- **LLM access is abstracted.** Paid AI work goes through a single swappable `LlmService` (Anthropic-direct is
  the dev default) so the provider can move to Azure AI Foundry / Vertex EU without touching callers.
  **EU data-residency for minors is a hard gate before any production LLM call** — see the data-flow options
  below.
- **Minors' data:** primary region **Austria East** keeps data at rest in Austria; DR backups stay within the
  EU (Germany West Central). Explicit parent consent for homework images; short retention via Blob lifecycle;
  the logging rules in §6 are part of this commitment. **LLM data-flow — three options, in preference order
  once verified:**
  1. **Claude on Azure AI Foundry (serverless/MaaS).** Claude is now in the Foundry catalog, so inference can
     stay inside the Azure billing + security boundary, billed via Azure, and pair with **Azure AI Content
     Safety** (valuable for a children's app). *Prefer this if* the region check passes — Anthropic's Supported
     Regions Policy applies, so confirm the Claude model you need is consumable from Austria East or another
     **EU** region with EU data handling; also confirm the catalog's model version isn't lagging what you need.
  2. **Anthropic API direct.** Simplest path and always the newest models, but it's an external seam: keep a
     **DPA**, send the *digest* (not raw child identifiers) where possible, and document the data flow.
  3. **Claude via Vertex AI or Bedrock (EU regions).** Fallback escape hatches if strict in-EU residency is
     required and Foundry's region/version doesn't fit — at the cost of a second cloud relationship.
  Whichever is chosen, the same rules hold: **DPA in place, send the digest not raw identifiers where possible,
  and document the data flow.** TTS (Azure AI Speech or external) follows the same DPA + minimal-data discipline.
- **Observability:** `requestId` threads request → logs → error envelope → support. Optional Sentry on both
  ends with PII scrubbing. Health checks drive Container Apps restarts.

---

## 9. Payments

**Approach:** a **Merchant of Record (MoR)** — **Lemon Squeezy or Paddle** — is the legal seller. It hosts the
checkout, takes the card, and **files EU VAT/OSS for you** — the single biggest reason a solo operator should
not use a raw payment gateway here. Card data **never touches our backend** (PCI scope ≈ zero). This also keeps
us inside the platform's prohibited-action boundary: the backend stores **no** card or financial credentials.

**Model (per the earlier design):** free core (unlimited bank practice, scheduling, progress, Web-Speech voice)
+ **Supporter** tier and/or **credit packs** for the genuinely expensive AI ops (LLM sessions, chat, homework
vision, premium neural TTS) + **pay-it-forward** so payers can subsidise families who can't. All billing UI is
**parent-area only, behind the PIN** — the child never sees a price, paywall, or buy button. No
lives/energy/loot mechanics anywhere.

**Flow (card data never reaches us):**
```
parent area ──POST /billing/checkout──▶ backend creates MoR checkout ──▶ returns hosted checkoutUrl
parent pays on MoR-hosted page (PCI handled by MoR)
MoR ──webhook (signed)──▶ POST /api/v1/billing/webhook ──▶ verify signature ──▶ update entitlement + credits_ledger
```

**Backend responsibilities**
- `entitlement(account)` = `free | supporter` (status, renews_at); `credits_ledger` is append-only, balance =
  `sum(delta)`. Gated (★) endpoints check entitlement/credits **before** doing paid work; `0` credits → `402
  INSUFFICIENT_CREDITS` (frontend routes the **parent** to the supporter screen, never the child).
- **Webhook is the source of truth for entitlement** — verify the provider signature, and make it **idempotent
  on the provider event id** (per API rule §4). Never trust client-reported payment success.
- **Pay-it-forward:** `checkout` accepts `payItForwardAmount`; on payment, credit a **subsidy pool**
  (`reason='pay_it_forward_gift'`) and grant pool credits to flagged free accounts (`reason='subsidy_grant'`).
- **Transparency:** `GET /billing/status` returns tier, credit balance, and the funded count, feeding the
  parent-area line "AI-Nutzung ≈ €X · dein Beitrag fördert N Kinder."
- **Refunds/chargebacks/cancellations** arrive as webhooks too — handle them to revoke entitlement / reverse
  ledger entries.

**Entity/VAT:** confirm with your tax advisor which entity is the contracting party behind the MoR and whether
a GmbH or a Verein best fits a cost-recovery (non-profit-leaning) intent. **RevenueCat** is *not* used for the
web PWA — revisit only if you later ship via the app stores, where IAP rules and 15–30% fees apply.

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
- Author/optimize SVGs with **SVGO**; store app SVGs in `assets/svg/` (bundled) or Blob for generated ones.
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


renderers, telemetry), `item_bank.seed.json` (starter content). This file governs the seams between them.*
