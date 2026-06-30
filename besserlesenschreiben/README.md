# besserlesenschreiben

Adaptive German children's literacy tutor (reading & writing). A mobile-friendly PWA frontend and a separate
API backend, built to be developed with **Claude Code** and iterated visually in **Claude Design**.

## What's in here

```
besserlesenschreiben/
├── README.md            ← you are here
├── ARCHITECTURE.md      ← GOVERNING doc for both projects (read this second)
├── backend/             ← the API service  (TypeScript · NestJS · Postgres · Azure)
│   ├── AGENTS.md        ← Claude Code: read this FIRST when working in backend/
│   ├── SPEC.md          ← backend data model, endpoints, algorithms
│   ├── item_bank.seed.json   ← starter exercise content (37 items, 7 units)
│   ├── prisma/seed.ts   ← idempotent seed loader (prisma db seed)
│   └── scripts/build-seed.ts ← regenerates the seed JSON from source
└── frontend/            ← the SPA / PWA  (TypeScript · React · Vite · Tailwind)
    ├── AGENTS.md        ← Claude Code: read this FIRST when working in frontend/
    └── SPEC.md          ← screens, the 17 exercise renderers, telemetry
```

## How to start with Claude Code

This is **two projects in one directory**. Open Claude Code at this root to build both, or `cd` into a
subfolder to build one at a time. Either way, the agent should read, in order:
**`<subproject>/AGENTS.md` → `ARCHITECTURE.md` → `<subproject>/SPEC.md`.**

Suggested order of work (each project's milestones are in its SPEC):
1. **Backend first** — auth + profiles + parent PIN (the security boundary everything depends on), then the
   item bank (load `item_bank.seed.json`), sessions + attempts, progress, digest, chat, homework, billing.
2. **Frontend** — app shell + auth screens, onboarding, the home + session loop, then the 17 renderers +
   telemetry (the bulk), then progress/voice/accessibility, chat, and the parent area + billing.

The frontend depends on the backend's API contract (`backend/SPEC.md §6`). Build the backend endpoints a
feature needs before the frontend feature that calls them.

## Non-negotiables (full detail in ARCHITECTURE.md)

- **The API is the boundary.** Frontend holds no business logic; backend serves no HTML. The OpenAPI-generated
  types keep them in lockstep — never hand-edit the contract on one side only.
- **Security boundary.** `user_id`/`profile_id` come only from the auth token; blob access is via SAS scoped to
  the caller's prefix; parent-scope + entitlement gate the routes that need them; PIN/login-code are hashed +
  rate-limited.
- **This is a children's app.** The logging rules, the SVG-first media policy, EXIF stripping on photos, and
  EU/Austria data residency are part of the build, not afterthoughts.
- **Payments** live in the parent area only, behind the PIN — never shown to a child.

## Hosting

Azure, primary region **Austria East (Vienna)** (data at rest in Austria), Switzerland North as fallback.
**Before building infra: confirm each Azure service is GA in Austria East** (Container Apps, PostgreSQL
Flexible Server, Blob, Key Vault, Communication Services) — newer regions get services in waves.

## If you split this into two repos later

`ARCHITECTURE.md` is shared. Copy it into each repo (or a shared submodule) and fix the `../ARCHITECTURE.md`
relative links in the SPECs and AGENTS files.
