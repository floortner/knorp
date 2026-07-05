# besserlesenschreiben

Adaptive German children's literacy tutor (reading & writing). A mobile-friendly PWA frontend, a separate
API backend, and an internal staff portal for professional homework review — built to be developed with
**Claude Code** and iterated visually in **Claude Design**.

## What's in here

```
besserlesenschreiben/
├── README.md            ← you are here
├── ARCHITECTURE.md      ← GOVERNING doc for all three projects (read this second)
├── backend/             ← the API service  (TypeScript · NestJS · Postgres · AWS)
│   ├── AGENTS.md        ← Claude Code: read this FIRST when working in backend/
│   ├── SPEC.md          ← backend data model, endpoints, algorithms
│   ├── item_bank.seed.json   ← starter exercise content (37 items, 7 units)
│   ├── prisma/seed.ts   ← idempotent seed loader (prisma db seed)
│   └── scripts/build-seed.ts ← regenerates the seed JSON from source
├── frontend/            ← the family SPA / PWA  (TypeScript · React · Vite · Tailwind)
│   ├── AGENTS.md        ← Claude Code: read this FIRST when working in frontend/
│   └── SPEC.md          ← screens, the 14 Vokaltraining exercise renderers, telemetry
└── reviewer/            ← internal STAFF portal for homework review  (React · Vite · Tailwind)
    ├── AGENTS.md        ← Claude Code: read this FIRST when working in reviewer/
    └── README.md        ← what it is, layout, the review flow
```

The **family app** (`frontend/`) and the **reviewer portal** (`reviewer/`) are **two disjoint auth realms**
(ARCHITECTURE §1a): a credential in one is never valid in the other. The reviewer portal is internal-only
(~3 staff), desktop/tablet, and never shipped to families.

## How to start with Claude Code

This is **three projects in one directory**. Open Claude Code at this root to build across them, or `cd` into
a subfolder to build one at a time. Either way, the agent should read, in order:
**`<subproject>/AGENTS.md` → `ARCHITECTURE.md` → `<subproject>/SPEC.md` (or `README.md` for `reviewer/`).**

Suggested order of work (each project's milestones are in its SPEC; cross-cutting build order in
`backend/SPEC.md §12`):
1. **Backend first** — auth + profiles + parent PIN (the security boundary everything depends on), then the
   item bank (load `item_bank.seed.json`), sessions + attempts, progress, digest, chat, homework, then the
   **staff realm** (reviewer auth, review queue, authoritative apply — Phase 2.5). No billing — the app is free.
2. **Frontend** — app shell + auth screens, onboarding, the home + session loop, then the 14 renderers +
   telemetry (the bulk), then progress/voice/accessibility, chat, and the parent area (homework upload).
3. **Reviewer portal** — staff login, the pending-review queue, and the two-pane review screen. Builds on the
   backend `/staff/*` routes; until those land it runs against a **provisional** contract
   (`reviewer/src/lib/contract.ts`).

The frontends depend on the backend's API contract (`backend/SPEC.md §6`). Build the backend endpoints a
feature needs before the frontend/portal feature that calls them.

## Non-negotiables (full detail in ARCHITECTURE.md)

- **The API is the boundary.** The frontends hold no business logic; the backend serves no HTML. The
  OpenAPI-generated types keep them in lockstep — never hand-edit the contract on one side only.
- **Two disjoint auth realms.** The family app and the staff reviewer portal authenticate separately
  (different cookie/`aud`, different signing key); a credential in one is never valid in the other.
- **Security boundary.** `user_id`/`profile_id` come only from the auth token; object-storage access is via
  presigned URLs scoped to the caller's prefix; parent-scope gates the routes that need it; PIN/login-code are
  hashed + rate-limited. Staff see only a **pseudonymised** review queue — no child name, parent email, chat, or billing.
- **This is a children's app.** The logging rules, the SVG-first media policy, EXIF stripping on photos, and
  EU data residency are part of the build, not afterthoughts.
- **Payments** live in the parent area only, behind the PIN — never shown to a child.

## Hosting

AWS, primary region **Frankfurt (eu-central-1)** (data at rest in the EU), Ireland (eu-west-1) as fallback.
Stack: small EC2 instance (backend, systemd), RDS PostgreSQL, S3 (+ CloudFront for the frontends), SSM
Parameter Store, SES. Deployment itself is a future milestone — see ARCHITECTURE §7.

## If you split this into separate repos later

The three subprojects split into `-api` / `-web` / `-review`. `ARCHITECTURE.md` is shared — copy it into each
repo (or a shared submodule) and fix the `../ARCHITECTURE.md` relative links in the SPECs and AGENTS files.
