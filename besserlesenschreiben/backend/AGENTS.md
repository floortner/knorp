# AGENTS.md — backend (`-api`)

Instructions for AI coding agents (Claude Code) working in this folder. Read this **first**, then
`../ARCHITECTURE.md`, then `./SPEC.md`. On any conflict, `../ARCHITECTURE.md` wins.

## What this is
The API service for an adaptive German literacy tutor for students (ages 8-14). TypeScript · NestJS · PostgreSQL · AWS.
Pure HTTP/JSON service — it serves no HTML. The frontend (`../frontend`) is the only client.

## Stack (pinned lines — see ARCHITECTURE §2 for the table)
Node 24 LTS · TypeScript 5.x · NestJS 11 (Fastify adapter) · Zod 4 (+ `nestjs-zod`) · `@nestjs/swagger` ·
Prisma 7 (+ `@prisma/adapter-pg`, Prisma Migrate) · PostgreSQL 17 · `@aws-sdk/client-s3` +
`@aws-sdk/s3-request-presigner` · `@anthropic-ai/sdk` · `ts-fsrs` · `nestjs-pino` · Vitest.
Use `npm`; commit `package-lock.json`. Prisma 7 is ESM-first → set `moduleFormat = "cjs"` for NestJS.

## Read order before coding
1. `./SPEC.md` §6 (API contract) and §3 (schema) — the source of truth for shapes. The DB schema lives in
   `prisma/schema.prisma`; the DDL in §3 is its conceptual form.
2. `../ARCHITECTURE.md` §4 (API rules), §5 (errors), §6 (logging), §9 (payments), §10 (media).

## Golden rules (do not violate)
1. **`user_id` / `profile_id` come ONLY from the JWT** — never from a request body or path. Grep for this.
2. **Object-storage access = presigned URLs scoped to one object under the caller's prefix.** Never expose bucket credentials/paths.
3. **Destructive profile routes** (`/profiles/:id/reset`, `/profiles/:id/reset-chat`) assert ownership of `:id`
   against the JWT account (missing/foreign → 404). There is no PIN/parent elevation (removed 2026-07-22) —
   the family UI fronts them with a two-step confirmation instead.
4. **Access is gated by account status, not payment.** The family `JwtAuthGuard` requires `account.status='active'`
   (a per-request check → immediate revocation). AI (`★`) endpoints are **free** — no entitlement/credit/`402`
   check (billing deferred, ARCHITECTURE §9). Signup is silent pending-on-first-code: a first `/auth/request-code`
   creates a `pending` account and emails nothing until a **staff admin** approves it (still `200`, no enumeration).
5. **Two disjoint auth realms (ARCHITECTURE §1a).** `/staff/*` requires a staff cookie (`aud:'staff'`,
   `StaffAuthGuard`, signed with `STAFF_JWT_SECRET` ≠ `JWT_SECRET`); a family JWT never validates there and vice
   versa. The reviewer queue is **pseudonymised** (image + LLM draft + skill tags + grade band only). Staff
   user-administration (approve/deactivate/delete real emails) is **admin-role-only**, separate from the queue.
6. **Never log** student answers, homework/OCR content, emails, login codes, JWTs, presigned URLs, or bodies.
   Log identifiers + outcomes only (ARCHITECTURE §6).
7. **Errors use the one envelope** (`{error:{code,message,requestId,details}}`) via a global exception filter —
   never leak stack traces, Prisma errors, or provider errors to clients.
8. **The API is the contract.** Every route under `/api/v1`; breaking changes go to `/api/v2`, never edit in
   place. After any request/response shape change: edit the Zod schema in `src/contract/*`, then run
   `npm run openapi:export` (regenerates the committed `openapi.json`) and the frontend's `npm run gen:api`,
   and commit both. CI fails on drift. Annotate responses with `ApiZodResponse`/`ApiZodCreatedResponse` so the
   global `ZodResponseInterceptor` validates them at runtime (dev throws, prod logs+strips).
9. **No in-memory security state.** Lockout counters / rate-limit windows live in the DB (e.g. login-code
   attempts on `login_code`), never a process-local Map — the service scales to zero/out.

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
- Homework analysis must **not** mutate the learning profile before a **staff reviewer** approves. Vision writes
  `homework_upload.llm_analysis` (a draft); only the reviewer's authoritative `reviewed_analysis` mutates
  `attempt`/`review_state` and feeds the next lecture (SPEC §10, ARCHITECTURE §11). No parent-confirm step.

## Commands (create these as you scaffold)
- Install: `npm ci`   ·   Run: `npm run start:dev`
- Test: `npm test` (Vitest; include **golden** tests for `digest.md` and the `Exercise` JSON shapes)
- Lint/type: `npm run lint` (ESLint) · `npx tsc --noEmit`
- Contract: `npm run openapi:export` (regenerate `openapi.json`) → then `npm run gen:api` in `../frontend`; commit both.
- DB: `npx prisma migrate dev` (local) / `npx prisma migrate deploy` (CI) · `npx prisma generate`
- Seed: `npm run seed` (`prisma db seed` → `prisma/seed.ts`)
- Full local-dev setup (local Postgres, env, first run, calling the API): see [`./README.md`](./README.md).

## Build milestones
Shipped milestones and the forward plan live in the repo-root **[`ROADMAP.md`](../../ROADMAP.md)** — the
single source of truth. Everything through Phase 2.5 + Post-2.5 is done; billing is deferred (schema kept
dormant, ARCHITECTURE §9); TTS + deploy/hardening remain.

## Definition of done for a feature
Endpoint matches `SPEC.md §6`; `user_id` from token; correct error codes; structured logs with `requestId`
and no PII; tests green (incl. golden where output is a contract); `@nestjs/swagger` OpenAPI still generates cleanly.
