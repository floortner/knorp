# AGENTS.md — backend (`-api`)

Instructions for AI coding agents (Claude Code) working in this folder. Read this **first**, then
`../ARCHITECTURE.md`, then `./SPEC.md`. On any conflict, `../ARCHITECTURE.md` wins.

## What this is
The API service for an adaptive German literacy tutor for students (ages 8-14). TypeScript · NestJS · PostgreSQL · AWS.
Pure HTTP/JSON service — it serves no HTML. The frontend (`../frontend`) is the only client.

## Stack (pinned lines — see ARCHITECTURE §2 for the table)
Node 24 LTS · TypeScript 5.x · NestJS 11 (Fastify adapter) · Zod 4 (local `ZodDto`, no `nestjs-zod`) · `@nestjs/swagger` ·
Prisma 7 (+ `@prisma/adapter-pg`, Prisma Migrate) · PostgreSQL 17 · `@aws-sdk/client-s3` +
`@aws-sdk/s3-request-presigner` · `@anthropic-ai/sdk` · `ts-fsrs` · `nestjs-pino` · Vitest.
Use `npm`; commit `package-lock.json`. Prisma 7 is ESM-first → set `moduleFormat = "cjs"` for NestJS.

## Read order before coding
1. `./SPEC.md` §6 (API contract) and §3 (schema) — the source of truth for shapes. The DB schema lives in
   `prisma/schema.prisma`; the DDL in §3 is its conceptual form.
2. `../ARCHITECTURE.md` §4 (API rules), §5 (errors), §6 (logging), §9 (payments), §10 (media).

## Golden rules (do not violate)
The **security-boundary rules are canonical in `../ARCHITECTURE.md`** (§8 boundary + §1a realms + §5
errors + §6 logging) and mirrored in the repo-root `CLAUDE.md` — JWT-only ids, presigned single-object
URLs, ownership-checked destructive routes, status-gated access (no billing/`402`), two disjoint auth
realms (staff surfaces show the student's **name** — known-trainer model — but never parent
email/chat/billing outside the admin-only surface), no-PII logging, the one error envelope, no
in-memory security state. Follow them as written there. Backend-specific:

1. **The API is the contract.** Every route under `/api/v1`; breaking changes go to `/api/v2`, never edit
   in place. After any request/response shape change: edit the Zod schema in `src/contract/*`, then run
   `npm run openapi:export` (regenerates the committed `openapi.json`) and `npm run gen:api` in
   `../frontend` **and** `../trainer`, and commit all three. CI fails on drift. Annotate responses with
   `ApiZodResponse`/`ApiZodCreatedResponse` so the global `ZodResponseInterceptor` validates them at
   runtime (dev throws, prod logs+strips).
2. **Durable security state.** Lockout counters / rate-limit windows live in the DB (e.g. login-code
   attempts on `login_code`), never a process-local Map.

## Conventions
- **Wire format is camelCase JSON; DB columns are snake_case.** Use Prisma `@map`/`@@map` to bridge; keep the
  camelCase boundary in DTOs.
- **Controllers handle HTTP only.** Per-resource folders under `modules/` hold a controller + service + Zod DTOs.
  Heavy domain logic (session generation, fsrs, digest, vision) lives in `services/` as **plain injectables
  with no HTTP/controller concerns** (the dtctl transport-purity lesson).
- **Validation = Zod** via the local `ZodDto` factory (`src/common/zod-dto.ts`; `nestjs-zod` was replaced —
  its `@nest-zod/z` breaks under Zod 4). The same Zod schemas drive Claude structured output (a forced tool
  over the Zod-derived JSON Schema, re-validated + one re-ask) so the digest/homework JSON stays typed end-to-end.
- Session generation: **the database decides *what* to drill (deterministic, free); the LLM only generates new
  content + conversation** (SPEC §8). Most sessions must make zero LLM calls.
- Homework analysis must **not** mutate the learning profile before a **staff trainer** approves. Vision writes
  `homework_upload.llm_analysis` (a draft); only the trainer's authoritative `reviewed_analysis` mutates
  `attempt`/`review_state` and feeds the next lecture (SPEC §10, ARCHITECTURE §11). No parent-confirm step.

## Commands (create these as you scaffold)
- Install: `npm ci`   ·   Run: `npm run start:dev`
- Test: `npm test` (Vitest; include **golden** tests for `digest.md` and the `Exercise` JSON shapes)
- Lint/type: `npm run lint` (ESLint) · `npx tsc --noEmit`
- Contract: `npm run openapi:export` (regenerate `openapi.json`) → then `npm run gen:api` in `../frontend`; commit both.
- DB: `npx prisma migrate dev` (local) / `npx prisma migrate deploy` (CI) · `npx prisma generate`
- Seed: `npm run seed` (`prisma db seed` → `prisma/seed.ts`)
- Content: `npm run content:validate` (lint the `content/` lecture library, German errors) ·
  `npm run content:import` (versioned, idempotent import — deploy + local after `migrate dev`; ROADMAP §I)
- Full local-dev setup (local Postgres, env, first run, calling the API): see [`./README.md`](./README.md).

## Build milestones
The forward plan lives in the repo-root **[`ROADMAP.md`](../../ROADMAP.md)**; shipped detail + the pivot
log in **[`HISTORY.md`](../../HISTORY.md)**. The beta is deployed and live; billing + TTS are deferred.

## Definition of done for a feature
Endpoint matches `SPEC.md §6`; `user_id` from token; correct error codes; structured logs with `requestId`
and no PII; tests green (incl. golden where output is a contract); `@nestjs/swagger` OpenAPI still generates cleanly.
