# besserlesenschreiben — backend (`-api`)

The API service for an adaptive German literacy tutor for students (ages 8-14). TypeScript · NestJS (Fastify) ·
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
systemd (ARCHITECTURE §7 — the beta is **live**; deploys go through `deploy/release.sh` via GitHub
Actions → SSM) and is unrelated to this setup.

Milestone 1 (auth + profiles) needs **only Postgres** — no AWS/Anthropic/TTS. The
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
npm run seed                  # staff admins + dev accounts (idempotent)
npm run content:import        # import the content/ lecture library (idempotent, ROADMAP §I2)
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
`start:dev` console** instead of sending it. Two things to know first:

- **A fresh email gets NO code.** Signup is silent pending-on-first-code (CLAUDE.md rule 5): an unknown
  email creates a `pending` account and prints nothing. Use one of the `SEED_DEV_ACCOUNTS` logins
  (seeded ACTIVE by `npm run seed` — `DEV_FAMILY_EMAIL`, default `family@example.test`), or approve
  your pending account through the Trainer-Portal admin first.
- **`/auth/verify` returns no token.** It sets the session as an httpOnly cookie and returns only
  `{"isNewAccount":…}` — so curl needs a cookie jar. (The guard still *accepts* a Bearer header for
  API clients/tests, but this endpoint doesn't hand one out.)

```bash
# 1. request a code for a seeded dev account (always 200; the code lands in the server log)
curl -X POST localhost:3000/api/v1/auth/request-code \
  -H 'Content-Type: application/json' -d '{"email":"family@example.test"}'

# 2. copy the code from the console, verify it → the session cookie lands in the jar
curl -c /tmp/blsb.jar -X POST localhost:3000/api/v1/auth/verify \
  -H 'Content-Type: application/json' -d '{"email":"family@example.test","code":"1234"}'
# -> {"isNewAccount":false}

# 3. call an authed route with the cookie
curl -b /tmp/blsb.jar localhost:3000/api/v1/me
```

## External-service stubs

The app boots and milestones 1–4 are exercisable with **no external accounts**:

| Service | Dev stub | Real adapter |
|---|---|---|
| Login email | `EMAIL_PROVIDER=console` — prints the code to stdout | `ses` in prod (IAM role; `resend` as alternative) |
| Object storage (Blob) | local-filesystem fake under a temp dir | set `AWS_S3_BUCKET` (IAM role auth) |
| LLM (Anthropic) | canned chat + a canned homework-vision draft; lecture generation 503s | set `ANTHROPIC_API_KEY` — see "LLM cutover" below |
| TTS | Web-Speech fallback on the client | deferred (Polly later) |

## LLM cutover (switching from the stub to real Claude)

The LLM layer runs on a stub until `ANTHROPIC_API_KEY` is set (chat gets canned replies, homework
vision a canned draft; lecture generation returns 503, and the frontend falls back to bank sessions
with a friendly note). Cutover:

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
- A homework photo upload produces a draft in the trainer queue within ~a minute.

**3. Production:** set `ANTHROPIC_API_KEY` **and** `LLM_RESIDENCY_ACK=true` via SSM Parameter Store — the app
refuses to boot with a key but no residency acknowledgement (ARCHITECTURE §8). Watch the `llm.usage`
log lines (token counts per call) for daily cost.

**Troubleshooting**

| Symptom | Meaning |
|---|---|
| ★ endpoints return 503 | no key → stub selected (or provider/network failure — see logs) |
| ★ generation 503 with 'unerwartetes Format' | model output failed the schema twice (re-ask included) — check few-shots/prompt; the family app falls back to a bank session |
| our `429 RATE_LIMITED` | the per-profile daily cap, not Anthropic — kindgerecht by design |
| truncated chat replies | verify `thinking: {type:'disabled'}` is still set (current Sonnet models default to adaptive thinking, which eats `max_tokens`) |
| smoke fails the cache assert | `LLM_SYSTEM` must stay byte-stable between calls; check the `cache_control` marker |

## Reset the database

```bash
dropdb blsb_dev && createdb -O blsb blsb_dev   # wipe and recreate the empty database
```

Then re-run `npx prisma migrate dev` + `npm run seed` + `npm run content:import` to rebuild the
schema, accounts, and lecture library.
