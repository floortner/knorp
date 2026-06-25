# besserlesenschreiben — backend (`-api`)

The API service for an adaptive German children's literacy tutor. TypeScript · NestJS (Fastify) ·
PostgreSQL · Prisma · Azure. Pure HTTP/JSON — it serves no HTML; the frontend is the only client.

**Read order for conventions & contract:** [`AGENTS.md`](./AGENTS.md) → [`../ARCHITECTURE.md`](../ARCHITECTURE.md) → [`SPEC.md`](./SPEC.md).
This file is just the **local-dev runbook**.

## Prerequisites

- **Node.js 24 LTS** (the pinned runtime — see ARCHITECTURE §2)
- **PostgreSQL 17** — installed via Homebrew (steps below). Alternatively use Postgres.app or a managed
  DB (Neon/Supabase/Azure) and just point `DATABASE_URL` at it; everything else is identical.

## Local vs production

Local dev runs the **Nest app on your host** (`npm run start:dev`, hot-reload) against a **local
PostgreSQL** (a Homebrew service). Production is the separate multi-stage `Dockerfile` → Azure
Container Apps (ARCHITECTURE §7) and is unrelated to this setup.

Milestone 1 (auth + profiles + parent PIN) needs **only Postgres** — no Azure/Anthropic/TTS. The
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
| LLM (Anthropic) | canned responses | milestone 5 (chat), 6 (vision) |
| TTS | canned / Web-Speech fallback on the client | milestone 5 |

## Reset the database

```bash
dropdb blsb_dev && createdb -O blsb blsb_dev   # wipe and recreate the empty database
```

Then re-run `npx prisma migrate dev` + `npm run seed` to rebuild the schema and content.
