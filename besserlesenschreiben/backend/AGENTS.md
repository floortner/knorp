# AGENTS.md — backend (`-api`)

Instructions for AI coding agents (Claude Code) working in this folder. Read this **first**, then
`../ARCHITECTURE.md`, then `./SPEC.md`. On any conflict, `../ARCHITECTURE.md` wins.

## What this is
The API service for an adaptive German children's literacy tutor. TypeScript · NestJS · PostgreSQL · Azure.
Pure HTTP/JSON service — it serves no HTML. The frontend (`../frontend`) is the only client.

## Stack (pinned lines — see ARCHITECTURE §2 for the table)
Node 24 LTS · TypeScript 5.x · NestJS 11 (Fastify adapter) · Zod 4 (+ `nestjs-zod`) · `@nestjs/swagger` ·
Prisma 7 (+ `@prisma/adapter-pg`, Prisma Migrate) · PostgreSQL 17 · `@azure/storage-blob` + `@azure/identity` ·
`@azure/keyvault-secrets` · `@anthropic-ai/sdk` · `ts-fsrs` · `nestjs-pino` · Vitest.
Use `npm`; commit `package-lock.json`. Prisma 7 is ESM-first → set `moduleFormat = "cjs"` for NestJS.

## Read order before coding
1. `./SPEC.md` §6 (API contract) and §3 (schema) — the source of truth for shapes. The DB schema lives in
   `prisma/schema.prisma`; the DDL in §3 is its conceptual form.
2. `../ARCHITECTURE.md` §4 (API rules), §5 (errors), §6 (logging), §9 (payments), §10 (media).

## Golden rules (do not violate)
1. **`user_id` / `profile_id` come ONLY from the JWT** — never from a request body or path. Grep for this.
2. **Blob access = user-delegation SAS scoped to the caller's prefix.** Never expose container keys/paths.
3. **Parent-scoped and billing routes require a fresh `parent` claim.** Reset/delete are destructive — gate them
   with a `ParentScopeGuard`.
4. **Gated AI endpoints check entitlement/credits BEFORE doing paid work** (an `EntitlementGuard`/interceptor).
   0 credits → `402`, do nothing paid.
5. **The webhook is the source of truth for billing**, verified by signature, idempotent on the provider event id.
6. **Never log** child answers, homework/OCR content, emails, login codes, PIN/hash, JWTs, SAS URLs, or bodies.
   Log identifiers + outcomes only (ARCHITECTURE §6).
7. **Errors use the one envelope** (`{error:{code,message,requestId,details}}`) via a global exception filter —
   never leak stack traces, Prisma errors, or provider errors to clients.
8. **The API is the contract.** Every route under `/api/v1`; breaking changes go to `/api/v2`, never edit in
   place. After any request/response shape change: edit the Zod schema in `src/contract/*`, then run
   `npm run openapi:export` (regenerates the committed `openapi.json`) and the frontend's `npm run gen:api`,
   and commit both. CI fails on drift. Annotate responses with `ApiZodResponse`/`ApiZodCreatedResponse` so the
   global `ZodResponseInterceptor` validates them at runtime (dev throws, prod logs+strips).
9. **No in-memory security state.** Lockout counters / rate-limit windows live in the DB (the PIN lockout uses
   `account.pin_attempts` + `pin_locked_until`), never a process-local Map — the service scales to zero/out.

## Conventions
- **Wire format is camelCase JSON; DB columns are snake_case.** Use Prisma `@map`/`@@map` to bridge; keep the
  camelCase boundary in DTOs.
- **Controllers handle HTTP only.** Per-resource folders under `modules/` hold a controller + service + Zod DTOs.
  Heavy domain logic (session generation, fsrs, digest, vision, tts) lives in `services/` as **plain injectables
  with no HTTP/controller concerns** (the dtctl transport-purity lesson).
- **Validation = Zod** via `nestjs-zod` (`createZodDto`); the same Zod schemas drive Claude structured output
  (`zodOutputFormat` + `messages.parse`) so the digest/homework JSON stays typed end-to-end.
- Session generation: **the database decides *what* to drill (deterministic, free); the LLM only generates new
  content + conversation** (SPEC §8). Most sessions must make zero LLM calls.
- Homework analysis must **not** mutate the learning profile before the parent confirms (SPEC §10).

## Commands (create these as you scaffold)
- Install: `npm ci`   ·   Run: `npm run start:dev`
- Test: `npm test` (Vitest; include **golden** tests for `digest.md` and the `Exercise` JSON shapes)
- Lint/type: `npm run lint` (ESLint) · `npx tsc --noEmit`
- Contract: `npm run openapi:export` (regenerate `openapi.json`) → then `npm run gen:api` in `../frontend`; commit both.
- DB: `npx prisma migrate dev` (local) / `npx prisma migrate deploy` (CI) · `npx prisma generate`
- Seed: `npm run seed` (`prisma db seed` → `prisma/seed.ts`)
- Full local-dev setup (local Postgres, env, first run, calling the API): see [`./README.md`](./README.md).

## Build milestones (SPEC §12)
Phase 1 (auth/profiles/sessions/attempts/progress/FSRS/digest) + Phase 1.5 hardening (response validation,
cookie auth, durable PIN lockout, prod email/storage adapters, 201 statuses, FSRS `learning_steps`, tests) are
**done**. Next is Phase 2 (★ gated): EntitlementGuard → LlmService → chat → homework vision → billing.

## Definition of done for a feature
Endpoint matches `SPEC.md §6`; `user_id` from token; correct error codes; structured logs with `requestId`
and no PII; tests green (incl. golden where output is a contract); `@nestjs/swagger` OpenAPI still generates cleanly.
