# SPEC — besserlesenschreiben **Backend**

Adaptive German children's literacy tutor. This is the **backend** project (separate repo/folder).
The frontend is a separate Vite/React SPA that talks to this service only over the HTTP API defined here.
**The API contract in §6 is the boundary — the frontend depends on it. Treat it as the source of truth.**

> **Governed by `../ARCHITECTURE.md`** (versions, API rules, errors, logging, hosting, payments, media). Read `./AGENTS.md` first, then `../ARCHITECTURE.md`, then this file. On any conflict, ARCHITECTURE wins.

---

## 1. Stack & principles

- **Language/framework:** Node.js 24 LTS + TypeScript + **NestJS 11** (Fastify adapter). **Zod** schemas
  (via `nestjs-zod`) for all request/response DTOs; `@nestjs/swagger` emits the OpenAPI the frontend types from.
- **DB:** PostgreSQL 17 via **Prisma 7** (`prisma/schema.prisma` is the model truth). Migrations with **Prisma Migrate**.
- **Object storage:** **Azure Blob Storage** (per-user prefixes, short-lived **SAS** URLs) via `@azure/storage-blob`.
- **Auth:** passwordless email code → JWT session token. Separate **parent PIN** elevation.
- **LLM:** `@anthropic-ai/sdk` (session generation, chat, homework vision); structured JSON via `zodOutputFormat` +
  `messages.parse` reuses the same Zod schemas. Model string configurable via env. See `../ARCHITECTURE.md` §8 for
  the direct-API vs Azure-Foundry data-flow decision.
- **TTS:** neural TTS provider (Azure AI Speech/Google `de-AT`/`de-DE`), pre-generated per item and cached in Blob.
- **Payments:** Merchant-of-Record (Lemon Squeezy or Paddle) via webhook → entitlements.
- **Hosting:** **Azure Container Apps** (region Austria East; see `../ARCHITECTURE.md` §7). **Never rely on local disk for persistence.**

**Hard rules (security boundary):**
1. `user_id` / `profile_id` is **always derived from the JWT**, never from a client-supplied path or body field.
2. All Blob access is via **user-delegation SAS scoped to the authenticated user's prefix**. Container keys/paths are never exposed.
3. Parent-scoped and billing endpoints require a valid **parent elevation claim** (§4).
4. Expensive AI endpoints require an **entitlement check** (§7) before doing any paid work.

---

## 2. Domain model

**Account = one parent email. Profiles = one or more children under it.** The child uses the device;
the parent email authenticates the household; the PIN re-gates parent controls and billing.

```
account (1) ───< profile (N children)
account (1) ───< credits_ledger
profile (1) ───< session ───< attempt
profile (1) ───< homework_upload
profile (1) ───< chat_message
profile (1) ───< review_state
item_bank (global, shared) ──referenced by── attempt.item_id
```

---

## 3. Database schema (canonical system of record)

Expressed as Postgres DDL below; the **source of truth in code is `prisma/schema.prisma`**, from which Prisma
generates the client and migrations. `item_bank.seed_key` is the unique natural key for idempotent seeding (§12).

```sql
-- ACCOUNT (household, keyed by parent email)
account(
  id              uuid pk,
  email           text unique not null,
  parent_pin_hash text,                 -- argon2; null until set at onboarding
  created_at      timestamptz default now()
)

-- LOGIN CODES (passwordless)
login_code(
  id          uuid pk,
  account_id  uuid fk -> account,       -- null-able: created on first request by email
  email       text not null,
  code_hash   text not null,            -- hash the 4-digit code too
  expires_at  timestamptz not null,     -- ~10 min
  consumed_at timestamptz,
  attempts    int default 0             -- rate-limit verify
)

-- PROFILE (a child)
profile(
  id            uuid pk,
  account_id    uuid fk -> account,
  name          text not null,
  buddy         text default 'nepo',    -- selectable buddy: nepo | stella (more mascot art in frontend/monster-pets, reserved for later)
  goal_per_week int  default 5,
  -- accessibility / settings (mirrors prototype state)
  sound_on      bool default true,
  dyslexic_font bool default false,
  font_scale    numeric default 1.0,
  -- gamification & progression state
  stars         int default 0,
  streak_days   int default 0,
  last_active   date,
  unlocked_unit int default 1,          -- highest unit unlocked; /parent/unlock-next increments it; drives /units status
  created_at    timestamptz default now()
)

-- ITEM BANK (global, was hardcoded LESSONS[] in the prototype; now server-owned)
item_bank(
  id            uuid pk,
  seed_key      text unique,            -- stable natural key for idempotent seeding (§12); null for generated_by='llm'
  unit          int not null,           -- which unit/Einheit (1..N)
  exercise_type text not null,          -- count|gap|order|rhyme|initial|letter|case|arrange|nonsense|pairs|bd|vowel
  payload       jsonb not null,         -- the exercise spec (see §8 for per-type shape)
  audio_url     text,                   -- pre-generated TTS for the word (SAS at read time)
  syllable_audio jsonb,                 -- optional per-syllable audio urls
  skill_tags    text[] not null,        -- e.g. {'vowel_ei','letter_discrimination','syllable_count'} (taxonomy: scripts/build-seed.ts)
  difficulty    int default 1,
  generated_by  text default 'seed',    -- seed | llm
  created_at    timestamptz default now()
)

-- SESSION (a generated training session = ordered list of items)
session(
  id           uuid pk,
  profile_id   uuid fk -> profile,
  unit         int,
  item_ids     uuid[] not null,         -- the items served, in order
  source       text not null,           -- 'bank' | 'llm' | 'homework'
  created_at   timestamptz default now(),
  completed_at timestamptz,
  stars_award  int
)

-- ATTEMPT (THE telemetry table — one row per answered item)
attempt(
  id            uuid pk,
  profile_id    uuid fk -> profile,
  session_id    uuid fk -> session,
  item_id       uuid fk -> item_bank,   -- null if from homework / ad-hoc
  exercise_type text not null,
  prompt        text not null,          -- word/glyph shown
  expected      text not null,          -- correct answer (stringified)
  given         text not null,          -- what the child chose (stringified)
  is_correct    bool not null,
  time_ms       int  not null,          -- render-of-item -> answer
  attempt_no    int  default 1,         -- retries within the same item
  skill_tags    text[] not null,
  created_at    timestamptz default now()
  -- IDEMPOTENCY (ARCHITECTURE §4): dedupe on (session_id, item_id, attempt_no). item_id is nullable
  -- (homework/ad-hoc) and NULLs are DISTINCT in Postgres, so a plain unique(...) won't dedupe those.
  -- Enforce with a functional unique index:
  --   UNIQUE (session_id, COALESCE(item_id, '00000000-0000-0000-0000-000000000000'), attempt_no)
)

-- FSRS scheduling state, one row per (profile, skill or item)
review_state(
  id             uuid pk,
  profile_id     uuid fk -> profile,
  skill_tag      text not null,         -- schedule per skill, not per word
  -- ts-fsrs Card state (the full set the scheduler reads/writes; don't store only stability/difficulty)
  stability      numeric,
  difficulty     numeric,
  state          int default 0,         -- 0=new 1=learning 2=review 3=relearning
  reps           int default 0,
  lapses         int default 0,
  elapsed_days   int default 0,
  scheduled_days int default 0,
  due            timestamptz,
  last_review    timestamptz,
  unique(profile_id, skill_tag)
)

-- HOMEWORK uploads + analysis
homework_upload(
  id           uuid pk,
  profile_id   uuid fk -> profile,
  image_key    text not null,           -- Blob key under user prefix
  status       text default 'pending',  -- pending|analyzed|confirmed|rejected
  analysis     jsonb,                    -- structured vision output (§9)
  confirmed_by text,                     -- parent must confirm before it mutates learning profile
  created_at   timestamptz default now()
)

-- CHAT (trainer conversation thread, per child profile; backs the /chat endpoints §6)
chat_message(
  id           uuid pk,
  profile_id   uuid fk -> profile,
  role         text not null,           -- 'child' | 'trainer' (mapped to me:bool on the wire)
  text         text not null,
  created_at   timestamptz default now()
)

-- BILLING: entitlements + credits ledger
entitlement(
  account_id   uuid pk fk -> account,
  tier         text default 'free',     -- free | supporter
  status       text default 'inactive', -- active|inactive|past_due
  renews_at    timestamptz,
  provider     text,                     -- lemonsqueezy|paddle
  provider_ref text
)

credits_ledger(
  id           uuid pk,
  account_id   uuid fk -> account,
  delta        int not null,            -- +N purchased / gifted, -1 per paid op consumed
  reason       text not null,           -- 'purchase'|'homework_scan'|'llm_session'|'pay_it_forward_gift'|'subsidy_grant'
  beneficiary  uuid,                    -- for pay-it-forward: which account received the gift
  created_at   timestamptz default now()
)

-- WEBHOOK idempotency: one row per provider event so billing webhooks dedupe replays (§7, ARCHITECTURE §4)
processed_webhook(
  provider     text not null,           -- lemonsqueezy | paddle
  event_id     text not null,           -- the provider's unique event id
  processed_at timestamptz default now(),
  primary key (provider, event_id)
)
```

`credits balance = SELECT sum(delta) FROM credits_ledger WHERE account_id = ?`

---

## 4. Auth & parent PIN

**Two distinct mechanisms — do not conflate:**

| | Email + 4-digit code | Parent PIN |
|---|---|---|
| Purpose | Account login (authenticate household) | Elevation gate inside a logged-in session (`sudo`) |
| Returns | JWT session token | Short-lived `parent` scope (~15 min) added to claims |
| Guards | Everything | `/parent/*` and `/billing/*` (destructive + sensitive) |

**Login flow**
1. `POST /auth/request-code {email}` → generate 4-digit code, store `code_hash` + 10-min expiry, email it. Always return 200 (don't leak which emails exist).
2. `POST /auth/verify {email, code}` → check hash + expiry, increment `attempts`, **lock after 5 fails**. On success issue JWT (`sub=account_id`, `exp`), upsert account.

**Parent PIN**
- Set at onboarding: `POST /parent/set-pin {pin}` → store **argon2 hash** (never plaintext); also clears any standing lockout.
- `POST /parent/verify-pin {pin}` → compare hash; **lock after 5 fails for 15 min** (4 digits = 10k combos). The lockout is **durable** — persisted on `account.pin_attempts` + `account.pin_locked_until`, not an in-memory Map — so it survives restarts and holds across scaled-out replicas (ARCHITECTURE §8). A correct PIN during the window returns `429 RATE_LIMITED`; a wrong PIN returns `403`. On success the counter is cleared and `parentToken` is returned: a **separate short-lived JWT** carrying a `parent` claim (~15 min). The client holds it and sends it on `‡` routes; `ParentScopeGuard` requires a valid, unexpired `parent` claim. It **does not replace** the session JWT.
- The prototype's "any 4 digits" client check must NOT survive into production — the PIN guards `reset` and analytics.

**Session cookie.** The session JWT (30-day TTL) is set as an **httpOnly, Secure, SameSite=Lax cookie** on `/auth/verify` and cleared on `POST /auth/logout`. `JwtAuthGuard` reads the cookie or a `Bearer` header (the SPA uses the cookie and holds no token in JS, deriving auth from a `/me` probe; API clients/tests may use Bearer).

---

## 5. Per-user storage layout (Azure Blob)

Prefix derived from the authenticated profile — **never** from client input.

```
users/{account_id}/{profile_id}/
  profile.md                 # preferences + settings, human/LLM legible
  digest.md                  # derived performance digest (§6 /digest)
  attempts.jsonl             # optional append-only raw mirror of attempt rows
  sessions/{date}.md         # each generated session, markdown
  homework/{date}-{id}.webp  # uploaded photo (EXIF stripped, transcoded — ARCHITECTURE §10)
  homework/{date}-{id}.md    # LLM analysis of that photo
```

Postgres holds metadata + pointers; Blob holds markdown + media. Reads/writes via SAS URLs scoped to the prefix.

---

## 6. API contract  *(shared boundary with frontend)*

All routes JSON unless noted. All require auth (cookie or `Bearer`) except `/auth/*`. `‡` = requires parent scope. `★` = entitlement/credit gated (Phase 2; checks credits **before** any paid work, `402` on zero).

This contract is **generated, not hand-written**: Zod schemas in `src/contract/*` → `openapi.json` (`npm run openapi:export`) → frontend `api.gen.ts` (`npm run gen:api`), with a CI drift gate. Every 2xx response is also validated at runtime against its Zod schema by a global `ZodResponseInterceptor` (dev: throws on mismatch; prod: logs + strips), so the documented shape can't drift from the served one.

### Auth
```
POST /auth/request-code     {email}                  -> 200 {ok:true}
POST /auth/verify           {email, code}            -> 200 {token, isNewAccount}   # also Set-Cookie: session
POST /auth/logout                                    -> 200 {ok:true}               # clears the session cookie
```

### Profiles & settings
```
GET   /me                                            -> {account, profiles:[...]}
POST  /profiles             {name, buddy, goal}      -> 201 {profile}    # onboarding (resource created)
GET   /profiles/{id}                                 -> {profile, settings, stars, streak}
PATCH /profiles/{id}/settings {soundOn?,dyslexicFont?,fontScale?,goal?,buddy?} -> {profile}
```

### Units, sessions, attempts  (the core loop)
```
GET  /units                                          -> [{unit, title, subtitle, focus,
                            exerciseTypes, itemCount, status, theme:{iconBg, iconColor}}]
POST /sessions              {profileId, unit?, source?} -> 201 {sessionId, profileId, unit,
                            generatedAt, items:[Exercise]}                     # ★ if source='llm'
POST /attempts             {sessionId, itemId?, exerciseType, prompt,
                            expected, given, isCorrect, timeMs, attemptNo, skillTags}
                                                     -> 200 {ok:true}   # idempotent → 200, not 201
POST /sessions/{id}/complete                         -> 200 {starsAwarded, streakDays, league}   # idempotent
```
- `unit` is the integer index (matches `item_bank.unit` / `session.unit`). `status` is per-profile:
  `locked | current | done`. The golden shapes are `../frontend/fixtures/units.example.json` and
  `session.example.json`.
- `Exercise` shape is per-type — see `../frontend/SPEC.md` §3 / backend §8. Backend serves it; frontend renders it.
- `/attempts` is high-frequency; keep it a thin fast insert. Mirror to `attempts.jsonl` async.

### Progress
```
GET /progress/{profileId}   -> {streakDays, stars, weeklyActivity:[7], monthlyHeatmap,
                                league:{tier, starsWeek, starsToNext}, skillBreakdown:[...]}
GET /digest/{profileId}     -> {markdown}   # regenerated from attempt table on demand (§ below)
```

### Chat (trainer)
```
GET  /chat/{profileId}                               -> {messages:[{me:bool, text, ts}]}
POST /chat/{profileId}      {text}                   -> {reply:{me:false, text}}   # ★ LLM
```

### Homework
```
POST /homework             (multipart: image, profileId)  -> {uploadId, status:'pending'}   # ★
GET  /homework/{id}                                  -> {status, analysis}
POST /homework/{id}/confirm ‡ {accept:bool, edits?}  -> applies analysis to learning profile
```

### Parent & billing
```
POST /parent/set-pin       {pin}                     -> {ok}
POST /parent/verify-pin    {pin}                     -> {parentToken}
POST /parent/unlock-next   ‡ {profileId}             -> {ok}
POST /parent/reset         ‡ {profileId}             -> {ok}     # destructive; parent scope mandatory
GET  /billing/status       ‡                         -> {tier, status, credits, payItForwardFunded}
POST /billing/checkout     ‡ {plan|creditPack, payItForwardAmount?} -> {checkoutUrl}
POST /billing/webhook      (provider signature)      -> 200      # NO auth header; verify signature
```

### Digest generation (`GET /digest`)
Regenerate `digest.md` from the `attempt` table (last ~14 days), write to Blob, return markdown.
This is the **LLM-facing view** — compact, not raw rows. Target format:

```markdown
# Lernprofil: {name} · Buddy {buddy} · Ziel {goal}×/Woche · Schrift: {a11y}

## Letzte 14 Tage
| Skill | Versuche | Richtig % | Ø Zeit | Trend |
|-------|---------:|----------:|-------:|-------|
| ...   |          |           |        |       |

## Zuletzt falsch (Wiederholung nötig)
- "{prompt}" → {error description} ({n}×)

## Fällig laut FSRS
- {skill}: {example items}

## Präferenzen
- Ton: an/aus · Buddy: {buddy} · Schwierigkeitswunsch: ...
```

---

## 7. Billing logic

- **Free tier:** unlimited bank sessions, scheduling, progress, Web-Speech voice. No gate.
- **Gated (★) ops:** `source='llm'` sessions, `/chat` LLM replies, `/homework`, premium TTS.
  - Supporter subscription → included monthly quota.
  - Credit packs → decrement `credits_ledger` by 1 per op; **reject with 402 if balance ≤ 0** (frontend shows parent-area upsell, never shown to child).
- **Pay-it-forward:** `/billing/checkout` accepts `payItForwardAmount`; on payment, log `credits_ledger(+N, reason='pay_it_forward_gift')` to a **subsidy pool**; grant pool credits to flagged free accounts as `subsidy_grant`.
- **Webhook:** verify provider signature, update `entitlement` + ledger. Idempotent on `provider_ref`.
- **Transparency endpoint** feeds the parent-area "this month cost €X, you funded Y" line.

Payment surface rules: **all billing UI is parent-scoped**; the child app never references price, paywall, or purchase. No lives/energy/loot mechanics anywhere.

---

## 8. Session generation algorithm

Two mechanisms — **most sessions never touch the LLM:**

**A. Bank session (default, free, instant, deterministic)**
1. Query `attempt` for this profile: skills with low recent `is_correct` or high `time_ms`, weighted by recency.
2. Cross-reference `review_state` for FSRS-due skills.
3. Select `item_bank` rows matching weak/due `skill_tags`, mixed with some mastered items for confidence. Order easy→hard.
4. Return as a `session` (`source='bank'`).

**FSRS:** use the `ts-fsrs` package (or SM-2 as a simpler fallback). Schedule **per skill_tag**, not per word. Update `review_state` on `/attempts`.

**B. LLM session (★, for novelty / homework follow-up)**
1. Load `digest.md` (§6) — the compact markdown, not raw rows.
2. Prompt Claude: "Given this Lernprofil, generate N exercises of types {…} targeting {weak skills}, as JSON matching these schemas." Provide the per-type schemas (`../frontend/SPEC.md` §3).
3. Validate against the Zod schemas, insert into `item_bank` (`generated_by='llm'`), optionally trigger TTS synth, return as a `session` (`source='llm'`).

**Rule:** the database decides *what* to drill (deterministic, free); the LLM only generates *new content* and *conversation*.

---

## 9. TTS pipeline

- Vocabulary is **bounded** (item bank) → synthesize once, cache forever.
- On item insert (seed or LLM): enqueue a synth job → neural TTS (`de-AT` preferred for the Austrian practice, `de-DE` fine) → store audio in Blob → set `item_bank.audio_url` (+ per-syllable for `count`/`order` clapping).
- Frontend plays `audio_url` if present; **Web Speech API is the fallback** for dynamic text (chat) only.
- Verify current provider voices/pricing before committing — those change.

## 10. Homework vision pipeline

1. `POST /homework` → strip EXIF, transcode to WebP, store in Blob under user prefix, row `status='pending'` (see `../ARCHITECTURE.md` §10).
2. Send image to **Claude vision** with a structured prompt → **JSON only**:
   ```json
   {"topic":"...","exerciseType":"...","items":[
     {"prompt":"...","childAnswer":"...","correct":true,"errorType":"vowel_ei"}],
    "suggestedFocus":["vowel_ei","letter_discrimination"]}
   ```
3. Store as `homework/{date}.md` + `analysis` jsonb, `status='analyzed'`.
4. **Human-in-the-loop (mandatory):** child handwriting OCR is unreliable → parent confirms via
   `POST /homework/{id}/confirm` before anything mutates the learning profile. Only on confirm do we
   write derived `attempt` rows / adjust `review_state`, then optionally generate a targeted LLM session.

**Data-protection (minors):** parent-gated, short retention on raw images, EU data residency where the
provider offers it, explicit consent at upload. Bake in now.

---

## 11. Env vars
Validated at boot by a Zod env schema (`@nestjs/config`); fail fast if any are missing.
```
NODE_ENV= PORT=
DATABASE_URL=                    # Prisma connection string (Postgres)
JWT_SECRET=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=                 # configurable; see ../ARCHITECTURE.md §8
AZURE_STORAGE_ACCOUNT= AZURE_STORAGE_CONTAINER=   # auth via Managed Identity / Key Vault, not keys in env
TTS_PROVIDER= TTS_KEY=
EMAIL_PROVIDER= EMAIL_KEY= EMAIL_FROM=   # login codes: console (dev) | resend (prod, needs KEY + FROM)
STORAGE_LOCAL_DIR=               # dev-only local Blob fake; unused when AZURE_STORAGE_ACCOUNT is set
BILLING_PROVIDER=                # lemonsqueezy|paddle
BILLING_WEBHOOK_SECRET=
```

## 12. Build milestones (suggested order for Claude Code)

**Phase 1 — free tier (DONE, merged + CI-green):**
1. ✅ Auth (email code + JWT, httpOnly cookie + logout), account/profile, settings, parent PIN.
2. ✅ Item bank: unique `seed_key` column, load `item_bank.seed.json` via `prisma/seed.ts` (`npm run seed`).
3. ✅ Sessions (bank) + attempts ingest + progress + FSRS.
4. ✅ Digest generation.

**Phase 1.5 — hardening (DONE):** runtime response-contract validation (`ZodResponseInterceptor`); httpOnly
cookie auth + `/me`-probe frontend; durable PIN lockout (`pin_attempts`/`pin_locked_until`); prod email
(Resend) + Azure Blob storage adapters (fail-loud, no silent no-op); 201 statuses on creating POSTs; FSRS
`learning_steps` persistence; React error boundary + renderer safety; offline session caching + telemetry
retention; guard/flow tests; these docs.

**Phase 2 — gated/paid (★, after 1.5):**
5. `EntitlementGuard` + `EntitlementService`/`CreditsService` (402 on zero credits) — prerequisite for every ★.
6. `LlmService` (abstracted; Anthropic-direct dev default, EU-residency gate before prod).
7. Chat (LLM) + TTS pipeline.
8. Homework vision + parent-confirm loop (needs storage + LlmService + EntitlementGuard).
9. Billing (entitlements, credits, webhook, pay-it-forward) — needs the MoR decision; PIN-gated, never in child tabs.

## 13. Acceptance checks
- `user_id` never read from request body/path; only from JWT. (grep the codebase.)
- Parent reset returns 403 without a fresh parent scope.
- `/attempts` insert < 50ms p95; data sufficient to rebuild `digest.md`.
- A bank session is generated with **zero** LLM calls.
- Gated op with 0 credits returns 402, logs nothing paid.
- Homework analysis cannot mutate `review_state` before parent confirm.
