# besserlesenschreiben — reviewer portal (`-review`)

The **internal staff portal** for professional homework review. A vetted literacy professional opens a
pending homework photo alongside its **LLM draft analysis**, validates or corrects it, and approves or
rejects. The verdict is **authoritative** — it shapes the child's next on-the-fly lecture and replaces the
old parent-confirm step (see [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §1a + §11, and
[`../backend/SPEC.md`](../backend/SPEC.md) §6/§10).

This is the **third subproject** of the monorepo, deployed independently (future `-review` repo). It is
**internal-only** (~3 hand-provisioned staff), never shipped to families, and `noindex`.

## What makes it different from the family app (`-web`)

| | family `-web` | this portal `-review` |
|---|---|---|
| Users | parents + children | ~3 internal staff reviewers |
| Auth realm | family cookie (`aud:"family"`) | **staff** cookie (`aud:"staff"`) — disjoint, separate key |
| Form factor | mobile-first PWA | **desktop/tablet, landscape, no PWA** |
| Data shown | the family's own data | **pseudonymised** queue: image + LLM draft + skill tags + grade band only |
| Look | warm child canvas, mascots | calm neutral slate tool |

## Two non-negotiables

1. **Staff realm only.** Auth is the staff httpOnly cookie; no token in JS. A family JWT never works here.
2. **Pseudonymisation.** The UI only ever shows the homework image, the LLM draft, skill tags, and a grade
   band — **never** a child name, parent email, chat, or billing. The backend won't send them; don't ask.

## Stack

Node 24 · TypeScript · React 19 · Vite 8 · Tailwind 4 (CSS-first `@theme`) · TanStack Query 5 ·
React Router 7 · Vitest + Testing Library. No PWA, no child fonts/mascots. Matches `-web`'s pinned lines
(`../ARCHITECTURE.md` §2).

## Layout

```
src/
  main.tsx  App.tsx          # providers + routes (/login, /login/code, /queue, /review/:uploadId)
  index.css                  # neutral staff @theme tokens (teal accent, slate surface)
  app/AppLayout.tsx          # top bar (reviewer identity + logout) over the routed Outlet
  lib/
    api.ts                   # transport only — staff cookie, error-envelope → ApiError
    contract.ts              # PROVISIONAL staff types (replace via `npm run gen:api` once backend ships /staff/*)
    endpoints.ts             # typed wrappers: staffAuthApi, reviewApi
    cn.ts
  features/
    auth/                    # StaffAuthProvider, /staff/me probe, RequireStaff guard, login + code screens
    queue/                   # QueueScreen + useQueue (pseudonymised pending list)
    review/                  # ReviewScreen (two-pane image | editable draft) + AnalysisEditor + claim/submit
  components/ui/             # button, input, textarea
```

## Develop

```bash
cp .env.example .env         # VITE_API_BASE → local backend (/api/v1)
npm install
npm run dev                  # http://localhost:5173
npm run lint                 # ESLint
npm run build                # tsc -b && vite build
npm test                     # Vitest
npm run gen:api              # regenerate types from backend OpenAPI — only once /staff/* is published
```

> **Status:** scaffold (Phase 2.5 / milestone 13 in `../backend/SPEC.md` §12). Screens render against the
> **provisional** `lib/contract.ts` and the typed `endpoints.ts`. The backend `staff/` module (auth, queue,
> authoritative apply) is milestones 10–12 and is **not implemented yet** — wire the portal to the real
> `/staff/*` routes, then regenerate the contract types, when it lands.

## The review flow (backend SPEC §10, ARCHITECTURE §11)

1. Family uploads a homework photo → backend stores it, runs Claude vision → `llm_analysis` **draft**
   (`status='pending_review'`), enqueued.
2. A reviewer opens an item here → it's **claimed** (soft lock; `409` if another holds it) → image + draft
   shown **side by side**.
3. Reviewer **approves** (unchanged), **corrects** (edits the draft), or **rejects** (unreadable/not homework).
4. Backend writes the **authoritative** `reviewed_analysis`, derives the child's `attempt`/`review_state`,
   records the LLM-vs-reviewer diff, and the validated focus shapes the **next** generated lecture. Async —
   the child is never blocked.
