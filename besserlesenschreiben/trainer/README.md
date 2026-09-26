# besserlesenschreiben — trainer portal (`-trainer`)

The **internal staff portal**: ~3 hand-provisioned trainers review homework photos against the LLM draft
(the verdict is authoritative — ARCHITECTURE §11), assign lectures from the content library, and follow
each student's activity. Desktop/tablet, landscape, `noindex`, never shipped to families. It lives in its
own **staff auth realm** — a family credential never works here (ARCHITECTURE §1a).

**Read order for conventions & contract:** [`AGENTS.md`](./AGENTS.md) → [`../ARCHITECTURE.md`](../ARCHITECTURE.md) → [`SPEC.md`](./SPEC.md)
(screen map, review-flow rules, data minimisation, acceptance checks). This file is just the
**local-dev runbook**.

## Develop

```bash
cp .env.example .env         # VITE_API_BASE → local backend (http://localhost:3000/api/v1)
npm install
npm run dev                  # http://localhost:5174 (strictPort — the family app owns :5173)
npm run lint                 # ESLint
npm run build                # tsc -b && vite build
npm test                     # Vitest + Testing Library
npm run gen:api              # regenerate src/lib/api.gen.ts from ../backend/openapi.json (committed; CI drift-gates it)
```

Or from the monorepo root: `../dev.sh trainer` (portal only) / `../dev.sh all` (with backend + family app).
The backend must be running with a seeded trainer account — `../backend/README.md` (`npm run seed` with
`SEED_DEV_ACCOUNTS=true` creates `DEV_TRAINER_EMAIL`; the login code prints to the backend console).

`api.gen.ts` types the backend's **full** OpenAPI even though the portal calls only `/staff/*` — so ANY
backend contract change needs `npm run gen:api` here too, or CI fails red.

## Where things are

```
src/
  App.tsx                    # routes: /login, /login/code, /queue, /review/:id, /history/:id,
                             #   /lectures[/:id], /students[/:id[/sessions/:id]], /users, /profile
  app/AppLayout.tsx          # top bar: brand, nav (Chats · Lektionen · Schüler · Nutzer · Profil), logout
  lib/                       # api.ts (transport only) · api.gen.ts (generated) · contract.ts · endpoints.ts
  features/                  # auth · queue · review · lectures · students · users (ADMIN) · profile · progress
  components/ui/             # button, input, select, textarea, modal, filter-chips, image-lightbox
```

**Status:** built and CI-green; the beta is **paused since 2026-09-12**, so there is no live environment.
