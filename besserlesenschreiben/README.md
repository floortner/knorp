# besserlesenschreiben

Adaptive German literacy tutor (reading & writing) for students aged 8–14. A mobile-friendly PWA for
families, a separate API backend, and an internal staff portal for professional homework review — built
to be developed with **Claude Code** and iterated visually in **Claude Design**.

## What's in here

```
besserlesenschreiben/
├── README.md            ← you are here
├── ARCHITECTURE.md      ← GOVERNING doc for all three projects (read this second)
├── dev.sh               ← start backend + frontends together for local dev
├── backend/             ← the API service  (TypeScript · NestJS · Postgres · AWS)
│   ├── AGENTS.md        ← Claude Code: read this FIRST when working in backend/
│   ├── SPEC.md          ← data model, endpoints, algorithms
│   ├── README.md        ← local-dev runbook (Postgres, seed, login, LLM cutover)
│   └── prisma/seed.ts   ← idempotent seed (staff admins + dev accounts)
├── frontend/            ← the family SPA / PWA  (TypeScript · React · Vite · Tailwind)
│   ├── AGENTS.md        ← Claude Code: read this FIRST when working in frontend/
│   └── SPEC.md          ← screens, the exercise renderers, telemetry
└── trainer/             ← internal STAFF portal (review + teaching console)  (React · Vite · Tailwind)
    ├── AGENTS.md        ← Claude Code: read this FIRST when working in trainer/
    ├── SPEC.md          ← screen map, review-flow rules, acceptance checks
    └── README.md        ← local-dev runbook
```

Lecture content lives outside these three, in the repo-root `content/` library — authored by the
linguist, validated in CI, imported at deploy (`content/README.md`).

The **family app** (`frontend/`) and the **trainer portal** (`trainer/`) are **two disjoint auth realms**
(ARCHITECTURE §1a): a credential in one is never valid in the other. The trainer portal is internal-only
(~3 staff), desktop/tablet, and never shipped to families.

## How to start with Claude Code

This is **three projects in one directory**. Open Claude Code at this root to build across them, or `cd`
into a subfolder to build one at a time. Either way, the agent reads, in order:
**`<subproject>/AGENTS.md` → `ARCHITECTURE.md` → `<subproject>/SPEC.md`.** The repo-root `CLAUDE.md`
holds the always-loaded working copy of the commands and the non-negotiable security rules.

**Status:** everything through the beta deployment is built; the beta is **paused since 2026-09-12**
(compute torn down, resume runbook in `../infra/README.md`). The forward plan lives in
[`../ROADMAP.md`](../ROADMAP.md), shipped detail + the pivot log in [`../HISTORY.md`](../HISTORY.md).

The three projects at a glance:
1. **Backend** — auth + profiles (the security boundary everything depends on), sessions + attempts,
   progress, digest, chat, homework, and the **staff realm** (trainer auth, review queue, authoritative
   apply, lectures, learner activity). No billing — the app is free.
2. **Frontend** — app shell + auth screens, onboarding, the home + session loop, the exercise renderers +
   telemetry, progress/voice/accessibility, chat (incl. homework upload).
3. **Trainer portal** — staff login, the review queue + two-pane review screen, the teaching console
   (Lektionen + Schüler), and the ADMIN surfaces (account approval, learner progress). Types are
   generated from the backend OpenAPI and drift-gated in CI.

The frontends depend on the backend's API contract (`backend/SPEC.md §6`). Build the backend endpoints a
feature needs before the frontend/portal feature that calls them.

## Run it

```bash
./dev.sh all        # backend :3000 + family :5173 + trainer :5174 (Ctrl-C stops all)
```
One-time Postgres setup first — `backend/README.md`. Real user journeys: `../e2e/README.md`.

## Non-negotiables

The API is the only boundary, the two auth realms never cross, ids come only from the auth token, the
app is for minors and it is free. The full list — with the reasons — is `ARCHITECTURE.md` §1a/§5/§6/§8/§9
and the always-loaded copy in the repo-root `CLAUDE.md`. Don't restate them here; read them there.

## Hosting

AWS, **Frankfurt (eu-central-1)**, one small EC2 box (backend + self-hosted Postgres + nginx/Let's
Encrypt) and S3 + CloudFront for both frontends — the €50/mo beta topology, authored in `../infra/`
(Terraform) and `../deploy/` (on-box scripts). Managed RDS, a second region and the rest of the
full-production hardening are deferred (ARCHITECTURE §7).

## If you split this into separate repos later

The three subprojects split into `-api` / `-web` / `-trainer`. `ARCHITECTURE.md` is shared — copy it into each
repo (or a shared submodule) and fix the `../ARCHITECTURE.md` relative links in the SPECs and AGENTS files.
