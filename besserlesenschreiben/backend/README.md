# besserlesenschreiben — backend (`-api`)

The API service for an adaptive German children's literacy tutor. TypeScript · NestJS (Fastify) ·
PostgreSQL · Prisma · AWS. Pure HTTP/JSON — it serves no HTML; the frontends are the only clients.

**Read order for conventions & contract:** [`AGENTS.md`](./AGENTS.md) → [`../ARCHITECTURE.md`](../ARCHITECTURE.md) → [`SPEC.md`](./SPEC.md).
This file is just the **local-dev runbook**.

## Prerequisites

- **Node.js 24 LTS** (the pinned runtime — see ARCHITECTURE §2)
- **PostgreSQL 17** — installed via Homebrew (steps below). Alternatively use Postgres.app or a managed
  DB (Neon/Supabase/RDS) and just point `DATABASE_URL` at it; everything else is identical.

## Local vs production

Local dev runs the **Nest app on your host** (`npm run start:dev`, hot-reload) against a **local
PostgreSQL** (a Homebrew service). Production is a small AWS EC2 instance running the built app under
systemd (ARCHITECTURE §7 — deployment is a future milestone) and is unrelated to this setup.

Milestone 1 (auth + profiles + parent PIN) needs **only Postgres** — no AWS/Anthropic/TTS. The
external services sit behind interfaces with dev fakes (see [stubs](#external-service-stubs)), so the
early milestones run fully offline.

## First-time setup

```bash
# 1. install & start PostgreSQL 17 (once per machine)
brew install postgresql@17
brew services start postgresql@17    # listens on localhost:5432, autostarts on login

# 2. create the role + database that .env.example expects (once)
psql postgres -c "CREATE ROLE blsb LOGIN PASSWORD 'devpass' SUPERUSER;"
createdb -O blsb blsb_dev

# 3. app setup
cp .env.example .env          # dev defaults already match the role/db created above
npm ci                        # install deps
npx prisma migrate dev        # create tables from prisma/schema.prisma
npm run seed                  # load item_bank.seed.json (idempotent)
```

## Run

```bash
npm run start:dev
```

The API listens on **`http://localhost:3000/api/v1`**. Quick liveness check:

```bash
curl localhost:3000/api/v1/health        # -> {"status":"ok","version":"…","commit":"…"}
```

## Calling the API

- **Swagger UI (interactive):** <http://localhost:3000/api/v1/docs> — "Try it out" on every endpoint.
- **OpenAPI JSON:** <http://localhost:3000/api/v1/openapi.json> — also what the frontend's
  `npm run gen:api` consumes.
- **curl / HTTPie / Bruno / Postman:** against the base URL above.

### Passwordless login (how to get an authed session locally)

There's no email server in dev, so `EMAIL_PROVIDER=console` **prints the 4-digit code to the
`start:dev` console** instead of sending it.

```bash
# 1. request a code (always 200; the code is printed in the server log)
curl -X POST localhost:3000/api/v1/auth/request-code \
  -H 'Content-Type: application/json' -d '{"email":"you@test.dev"}'

# 2. copy the code from the console, verify it → receive a JWT
curl -X POST localhost:3000/api/v1/auth/verify \
  -H 'Content-Type: application/json' -d '{"email":"you@test.dev","code":"1234"}'
# -> {"token":"eyJ…","isNewAccount":true}

# 3. call an authed route with the Bearer token
curl localhost:3000/api/v1/me -H 'Authorization: Bearer eyJ…'
```

For parent-scoped (`‡`) routes — e.g. `/parent/reset`, `/billing/*` — first
`POST /api/v1/parent/verify-pin {pin}` to get a short-lived `parentToken` (JWT with a `parent`
claim, ~15 min), then send it on those requests (SPEC §4).

## External-service stubs

The app boots and milestones 1–4 are exercisable with **no external accounts**:

| Service | Dev stub | Real adapter at |
|---|---|---|
| Login email | `EMAIL_PROVIDER=console` — prints the code to stdout | milestone 1 (prod provider) |
| Object storage (Blob) | local-filesystem fake under a temp dir | milestone 5/6 |
| LLM (Anthropic) | canned chat; ★ structured calls 503 | set `ANTHROPIC_API_KEY` — see "LLM cutover" below |
| TTS | canned / Web-Speech fallback on the client | milestone 5 |

## LLM cutover (switching from the stub to real Claude)

The LLM layer runs on a stub until `ANTHROPIC_API_KEY` is set (chat gets canned replies; ★ structured
calls return 503, and the frontend falls back to bank sessions with a friendly note). Cutover:

**1. Dev smoke (no database needed):**

```bash
# in backend/.env:  ANTHROPIC_API_KEY=sk-ant-…
npm run llm:smoke             # chat probe + generation probe ×2 (asserts a prompt-cache hit)
npm run llm:smoke -- --vision # additionally probes homework vision (Opus call — costs more)
```

The generation probe validates the model's output against the REAL contract (`generatedSessionSchema`
incl. per-type solvability) — if it passes, LLM lectures are safe to serve. The summary prints token
counts and a rough € cost per call.

**2. Full-app smoke (local DB):** start `../dev.sh`, then check:
- ✨ „Neue Übungen für dich" generates a real lecture — intro card, then solvable exercises.
- The 6th ✨ session of the day returns the friendly cap message (`LLM_SESSIONS_PER_DAY=5`).
- Chat answers as Angelika (capped at `CHAT_MESSAGES_PER_DAY=60`).
- A homework photo upload produces a draft in the reviewer queue within ~a minute.

**3. Production:** set `ANTHROPIC_API_KEY` **and** `LLM_RESIDENCY_ACK=true` via SSM Parameter Store — the app
refuses to boot with a key but no residency acknowledgement (ARCHITECTURE §8). Watch the `llm.usage`
log lines (token counts per call) for daily cost.

**Troubleshooting**

| Symptom | Meaning |
|---|---|
| ★ endpoints return 503 | no key → stub selected (or provider/network failure — see logs) |
| ★ endpoints return 502 | model output failed the schema twice (re-ask included) — check few-shots/prompt |
| our `429 RATE_LIMITED` | the per-profile daily cap, not Anthropic — kindgerecht by design |
| truncated chat replies | verify `thinking: {type:'disabled'}` is still set (current Sonnet models default to adaptive thinking, which eats `max_tokens`) |
| smoke fails the cache assert | `LLM_SYSTEM` must stay byte-stable between calls; check the `cache_control` marker |

## Reset the database

```bash
dropdb blsb_dev && createdb -O blsb blsb_dev   # wipe and recreate the empty database
```

Then re-run `npx prisma migrate dev` + `npm run seed` to rebuild the schema and content.
