# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**besserlesenschreiben** — an adaptive German children's literacy tutor. Two sub-projects that are developed together but deployed independently:

- `besserlesenschreiben/backend/` — NestJS API (`-api` repo)
- `besserlesenschreiben/frontend/` — Vite/React SPA/PWA (`-web` repo)

The seed scripts live in the backend: `besserlesenschreiben/backend/prisma/seed.ts` (idempotent item-bank loader, run via `npm run seed`). There are no root-level `seed.ts`/`build-seed.ts`.

Currently one **monorepo** for fast cross-cutting iteration; the two subprojects are independently buildable/deployable and split into the `-api`/`-web` repos before launch (ARCHITECTURE §1).

## Read order before touching any code

1. **`<subproject>/AGENTS.md`** — the short, authoritative guide for the subproject you're working in (read this first)
2. **`besserlesenschreiben/ARCHITECTURE.md`** — governs both projects; wins over either SPEC on all cross-cutting concerns (API shape, errors, logging, versions, hosting, payments, media)
3. **`<subproject>/SPEC.md`** — the detailed spec for that project

## Commands

### Run both at once (local dev)
```bash
besserlesenschreiben/dev.sh          # start backend (:3000) + frontend (:5173), Ctrl-C stops both
besserlesenschreiben/dev.sh api      # backend only   ·   dev.sh web = frontend only
```
Copies missing `.env` files from `.env.example` and installs deps on first run. It does **not** set up
Postgres — do the one-time DB setup in `besserlesenschreiben/backend/README.md` first.

### Backend (`besserlesenschreiben/backend/`)
```bash
npm ci                          # install
npm run start:dev               # dev server
npm test                        # Vitest (includes golden tests for digest.md + Exercise JSON)
npm run lint                    # ESLint
npx tsc --noEmit                # typecheck
npx prisma migrate dev          # local DB migrations
npx prisma migrate deploy       # CI/prod migrations (run as pre-traffic step)
npx prisma generate             # regenerate Prisma client after schema changes
npm run seed                    # load item_bank.seed.json (idempotent, upserts on seed_key)
```

### Frontend (`besserlesenschreiben/frontend/`)
```bash
npm install                     # install
npm run dev                     # dev server
npm run build                   # production build (vite build)
npm test                        # golden snapshot tests for Exercise rendering contract
npm run gen:api                 # regenerate api.ts types from backend OpenAPI (openapi-typescript)
```

## Architecture overview

### System topology
```
Frontend (Vite/React SPA/PWA)  ←→  Backend (NestJS/Fastify)
                                        │
                    ┌───────────────────┼──────────────────┐
                    ▼                   ▼                  ▼
            Azure PostgreSQL   Azure Blob Storage   Anthropic API
            (Prisma 7)         (per-user SAS URLs)  (sessions/chat/vision)
```

The **API contract** (`backend/SPEC.md §6`) is the only boundary. The frontend holds no DB or business logic; the backend serves no HTML.

### Backend structure
- `src/modules/` — one folder per resource: controller (HTTP only) + service + Zod DTOs
- `src/services/` — domain logic only (sessions, fsrs, digest, tts, vision, storage, email) — **no HTTP concerns here**
- `src/common/guards/` — `JwtAuthGuard`, `ParentScopeGuard`, `EntitlementGuard`
- `src/common/filters/` — global exception filter → the one error envelope
- `prisma/schema.prisma` — the model truth; DDL in `backend/SPEC.md §3` is its conceptual form
- `prisma/seed.ts` — idempotent item-bank loader (upserts on `seed_key`)

### Frontend structure
- `src/lib/api.gen.ts` — types **generated** from backend OpenAPI (`npm run gen:api`), committed, never hand-edited
- `src/lib/api.ts` — typed fetch client, **transport only** (no JSX), built on `api.gen.ts` types
- `src/features/exercises/types.ts` — the `Exercise` discriminated union (12 types)
- `src/features/exercises/` — the 12 exercise renderers
- `src/lib/audio.ts` — `audioUrl` playback + Web Speech API fallback
- `src/lib/telemetry.ts` — attempt timing + fire-and-forget emit

`features/exercises/types.ts` and `lib/api.ts` **must stay in lockstep with the backend contract**. A change to either is a contract change — re-export `openapi.json`, regenerate `api.gen.ts` via `npm run gen:api`, and update golden tests.

### Session generation (two paths)
- **Bank session (default, free):** deterministic — queries `attempt` table for weak/due skills via FSRS (`ts-fsrs`), selects from `item_bank`. Zero LLM calls.
- **LLM session (★ gated):** loads `digest.md` → prompts Claude → validates against Zod schemas → inserts into `item_bank` (`generated_by='llm'`) → returns session.

The database decides *what* to drill; the LLM only generates *new content and conversation*.

## Non-negotiable security rules

1. **`user_id`/`profile_id` come ONLY from the JWT** — never from a request body or path parameter. Grep for violations.
2. **Blob access via user-delegation SAS scoped to the caller's prefix** (`users/{account_id}/{profile_id}/…`). Container keys never exposed.
3. **Parent-scoped routes** (`/parent/*`, `/billing/*`) require a fresh `parent` claim in the JWT (`ParentScopeGuard`).
4. **Gated AI endpoints** check entitlement/credits before doing any paid work (`EntitlementGuard`). Zero credits → `402`, nothing paid happens.
5. **Webhook is the billing source of truth** — verify provider signature, idempotent on provider event id. Never trust client-reported payment success.
6. **Never log** child answers, homework/OCR content, email addresses, login codes, PIN or its hash, JWTs, SAS URLs, or request/response bodies. Log identifiers + outcomes only.
7. **One error envelope** for every non-2xx response: `{error:{code,message,requestId,details[]}}`. The global exception filter handles this — never leak Prisma/provider errors.
8. **Billing UI is parent-area only, behind the PIN.** A `402` routes the *parent* to the supporter screen — never show a price, paywall, or buy button in the child tabs.

## Key conventions

- **Wire format:** camelCase JSON on the wire; snake_case DB columns. Prisma `@map`/`@@map` bridges them.
- **Validation:** Zod via `nestjs-zod` (`createZodDto`). The same Zod schemas drive Claude structured output (`zodOutputFormat` + `messages.parse`) so Exercise JSON stays typed end-to-end.
- **Contract pipeline:** Zod schemas (`backend/src/contract/*`) → committed `backend/openapi.json` (`npm run openapi:export`) → committed `frontend/src/lib/api.gen.ts` (`npm run gen:api`), with a CI drift gate. Never hand-edit `api.gen.ts`. A global `ZodResponseInterceptor` also validates every 2xx response against its schema at runtime (dev throws, prod logs+strips).
- **Auth:** session JWT (30-day) in an **httpOnly, Secure, SameSite cookie** (`/auth/verify` sets it, `/auth/logout` clears it); the SPA holds no token in JS and derives auth from a `/me` probe. No in-memory security state in prod — the PIN lockout is durable (`account.pin_attempts`/`pin_locked_until`).
- **API versioning:** all routes under `/api/v1`. Breaking changes → `/api/v2`, never edit in place. Additive changes stay in v1.
- **Golden tests:** `digest.md` format (LLM-facing) and `Exercise` JSON (client-facing) are pinned with golden files. Any change to these contract outputs must update the golden files intentionally.
- **SVG-first media:** all app art, mascots (Nepo/Stella), icons, and badges are SVG. Sanitize any non-hand-authored SVG with DOMPurify before inlining — never `dangerouslySetInnerHTML` on raw SVG. Homework photos are the only raster exception (strip EXIF server-side, transcode to WebP).
- **Prisma 7 + NestJS:** Prisma 7 is ESM-first — set `moduleFormat = "cjs"` in the Prisma client generator config for NestJS's CommonJS setup.
- **Telemetry:** every answered exercise emits exactly one `POST /attempts` with a real `timeMs` (timer starts on item mount). Fire-and-forget; queue + retry offline via Workbox; never block the child's UI.

## Hosting & env

- **Azure Container Apps** (backend, scale-to-zero) + **Azure Static Web Apps** (frontend), region **Austria East (Vienna)** primary.
- Secrets in **Azure Key Vault** — nothing secret in the repo or image. See `backend/SPEC.md §11` for the full env var list (`.env.example` is committed).
- Migrations run as a **pre-traffic release step** (`prisma migrate deploy`), never at app startup.
- PWA update strategy: **prompt-to-update** (never silent reload mid-lesson).
