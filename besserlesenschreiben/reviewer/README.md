# besserlesenschreiben — reviewer portal (`-review`)

The **internal staff portal** for professional homework review. A vetted literacy professional opens a
pending homework photo alongside its **LLM draft analysis**, validates or corrects it, and approves or
rejects. The verdict is **authoritative** — it shapes the student's next on-the-fly lecture and replaces the
old parent-confirm step (see [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §1a + §11, and
[`../backend/SPEC.md`](../backend/SPEC.md) §6/§10).

This is the **third subproject** of the monorepo, deployed independently (future `-review` repo). It is
**internal-only** (~3 hand-provisioned staff), never shipped to families, and `noindex`.

## What makes it different from the family app (`-web`)

| | family `-web` | this portal `-review` |
|---|---|---|
| Users | parents + students | ~3 internal staff reviewers |
| Auth realm | family cookie (`aud:"family"`) | **staff** cookie (`aud:"staff"`) — disjoint, separate key |
| Form factor | mobile-first PWA | **desktop/tablet, landscape, no PWA** |
| Data shown | the family's own data | **pseudonymised** queue: image + LLM draft + skill tags + grade band only |
| Look | warm student canvas, mascots | calm neutral slate tool |

## Two non-negotiables

1. **Staff realm only.** Auth is the staff httpOnly cookie; no token in JS. A family JWT never works here.
2. **Pseudonymisation.** The UI only ever shows the homework image, the LLM draft, skill tags, and a grade
   band — **never** a student name, parent email, chat, or billing. The backend won't send them; don't ask.

## Stack

Node 24 · TypeScript · React 19 · Vite 8 · Tailwind 4 (CSS-first `@theme`) · TanStack Query 5 ·
React Router 7 · Vitest + Testing Library. No PWA, no student fonts/mascots. Matches `-web`'s pinned lines
(`../ARCHITECTURE.md` §2).

## Layout

```
src/
  main.tsx  App.tsx          # providers + routes (/login, /login/code, /queue, /review/:uploadId, /users, /lexemes)
  index.css                  # neutral staff @theme tokens (teal accent, slate surface)
  app/AppLayout.tsx          # top bar: (b) brand + reviewer name, nav with live count badges, logout
  lib/
    api.ts                   # transport only — staff cookie, error-envelope → ApiError
    api.gen.ts               # types GENERATED from backend OpenAPI (`npm run gen:api`), committed, never hand-edited
    contract.ts              # ergonomic aliases over api.gen.ts `operations` (no hand-authored shapes)
    endpoints.ts             # typed wrappers: staffAuthApi, reviewApi, usersApi, lexemesApi
    decision.ts  cn.ts
  features/
    auth/                    # StaffAuthProvider, /staff/me probe, RequireStaff guard, login + code screens
    queue/                   # review list "Chats" (Offen | Erledigt | Alle) — pseudonymised rows
    review/                  # ReviewScreen (two-pane image | editable draft) + AnalysisEditor + claim/submit
    users/                   # ADMIN "Nutzer": account approval/deactivate/delete + per-student progress
    lexemes/                 # ADMIN "Wortschatz": word-pool curation (filters, stats, editor, export)
    progress/                # shared learner-progress panel (summary · skills · activity)
  components/ui/             # button, input, select, textarea, modal, filter-chips
```

## Develop

```bash
cp .env.example .env         # VITE_API_BASE → local backend (/api/v1)
npm install
npm run dev                  # http://localhost:5174
npm run lint                 # ESLint
npm run build                # tsc -b && vite build
npm test                     # Vitest
npm run gen:api              # regenerate types from backend OpenAPI (committed; CI drift-gates it)
```

> **Status: shipped.** Wired to the live backend `staff/` module; types are generated from the published
> `/staff/*` OpenAPI (`lib/api.gen.ts`, committed) and aliased in `lib/contract.ts`; CI fails on drift, same
> as the family app. Beyond review, the portal carries the ADMIN surfaces: **Nutzer** (account lifecycle +
> per-student learner progress) and **Wortschatz** (lexeme-foundation curation — see `../backend/SPEC.md` §6).

## The review flow (backend SPEC §10, ARCHITECTURE §11)

1. Family uploads a homework photo → backend stores it, runs Claude vision → `llm_analysis` **draft**
   (`status='pending_review'`), enqueued.
2. A reviewer opens an item here → it's **claimed** (soft lock; `409` if another holds it) → image + draft
   shown **side by side**.
3. Reviewer **approves** (unchanged), **corrects** (edits the draft), or **rejects** (unreadable/not homework).
4. Backend writes the **authoritative** `reviewed_analysis`, derives the student's `attempt`/`review_state`,
   records the LLM-vs-reviewer diff, and the validated focus shapes the **next** generated lecture. Async —
   the student is never blocked.
