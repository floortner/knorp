# AGENTS.md — trainer portal (`-trainer`)

Instructions for AI coding agents (Claude Code) working in this folder. Read this **first**, then
`../ARCHITECTURE.md` (§1a + §11 especially), then `./SPEC.md` (this app's contract + acceptance
checks), then `../backend/SPEC.md` §6 (staff routes) + §10. On any conflict, `../ARCHITECTURE.md` wins.

## What this is
The **internal staff portal** — professional homework review plus the trainer's **learner directory and
student activity tracking** (ROADMAP §H: the portal is becoming the teaching console). A vetted literacy
professional reviews homework drafts (their verdict is **authoritative** and feeds the student's next
lecture, ARCHITECTURE §11) and tracks each student's sessions question-by-question to shape the next
material. It is a **pure HTTP client** over the backend `staff/` routes — it holds **no business logic**
(queue ordering, who may review, the authoritative-apply step, activity rollups all live in the backend).

This app is **internal-only**: ~3 hand-provisioned staff, never shipped to families, `noindex`.

## The two things that matter most
1. **This is the staff realm, not the family realm (ARCHITECTURE §1a).** Auth is the staff httpOnly cookie
   (`credentials:'include'`); there is **no token in JS**. Never import or reuse anything from the `-web`
   family app's auth. A family JWT must never work here and vice-versa (the backend enforces it; don't
   undermine it client-side).
2. **Minimise what you show (known-trainer model — ARCHITECTURE §1a).** Trainer surfaces show the
   student's **name and learning data** (the trainers know each student personally). **Never** render or
   request a parent email, chat text, billing, or account lifecycle outside the admin-only **Nutzer**
   surface — the backend won't send them; don't add a call that asks for them.

## Stack (matches `-web`; see ARCHITECTURE §2)
Node 24 LTS · TypeScript 5.x · React 19.2.x · Vite 8.1.x (+ @vitejs/plugin-react 6) · Tailwind CSS 4.3.x
(CSS-first `@theme`) · @tanstack/react-query 5.x · React Router 7 · Vitest + Testing Library.
**No PWA** (staff are online on desktop/tablet) and **no student fonts/mascots** — this is a calm, neutral,
information-dense tool.

## Form factor (deliberate)
**Desktop/laptop + tablet, landscape. NOT mobile-first.** The review screen is a **two-pane** layout
(homework image | editable analysis). Don't spend effort on narrow-phone layouts — that's the family app's
job. Comfortable tap targets for tablet are welcome.

## Golden rules (do not violate)
1. **`lib/api.ts` is transport only** — no JSX, no UI. Screens never hand-roll `fetch` or error parsing.
2. **Contract types are GENERATED, never hand-authored.** `lib/api.gen.ts` comes from the backend's
   **full** published OpenAPI via `npm run gen:api` (committed; CI drift-gates it) — never edit it.
   The portal only *calls* `/staff/*`, but the generated file covers every route, so **any** backend
   contract change (family routes included) requires a regen here or the drift gate fails red.
   `lib/contract.ts` only re-exports ergonomic aliases over the generated `operations` (the `-web`
   `lib/types.ts` pattern). After any backend contract change: re-export `openapi.json`, run
   `gen:api`, commit both. Keep the exported type names stable.
3. **The trainer verdict is authoritative; the LLM output is a draft.** The UI seeds the editor from
   `llmAnalysis` and submits the (possibly corrected) copy as `reviewedAnalysis`. `approved` = unchanged,
   `corrected` = edited, `rejected` = unreadable/not-homework (sends no analysis). Don't apply anything
   locally — the backend does the authoritative write.
4. **Claim before you edit.** Entering a review soft-locks the item (`POST /staff/queue/{id}/claim`); a `409`
   means another trainer holds it — surface that, don't fight it.
5. **One error envelope (ARCHITECTURE §5).** `ApiError.code` is the stable switch; never parse `message`.
   `401/SESSION_EXPIRED` clears auth and redirects to `/login` once.

## Conventions
- TanStack Query for ALL server state; key prefixes: `['staff-me']`, `['staff-queue', …]`, `['staff-users', …]`, `['staff-students', …]` / `['staff-student…', …]` (mutations invalidate by prefix).
- Auth state is derived from a `/staff/me` probe (survives refresh); see `features/auth/`.
- Brand accent is teal (shared), but the surface is neutral slate/white — see `src/index.css` `@theme`.
- German UI copy (the staff are German/Austrian).
- **No emoticons/emoji in UI copy** unless explicitly asked for — this is a professional tool, not the
  family app. Icons come from **lucide-react only**, used consistently (same icon for the same concept
  everywhere, e.g. the nav icon reappears in that screen's empty state).

## Commands
- Install: `npm install`  ·  Dev: `npm run dev` (port **5174**)  ·  Build: `npm run build` (tsc -b + vite)
- Lint: `npm run lint`  ·  Test: `npm test` (Vitest)  ·  Types from API: `npm run gen:api`

## What's built (Phase 2.5 + post-2.5 — all DONE; full roadmap in [`../../ROADMAP.md`](../../ROADMAP.md))
- Shell + staff auth · queue "Chats" with history filter (Offen | Erledigt | Alle), "Mehr laden" cursor
  paging, waiting-since cue and "in Prüfung" claim locks + nav count badges · two-pane review screen (claim,
  approve/correct/reject-with-confirm, submit→next-item flow, unsaved-changes guard, image lightbox with
  zoom/rotate) · read-only history detail (`/history/:uploadId`) for decided items · own profile page
  (**Profil** nav tab → `/profile`: rename self, see login email/role/access date; audit trail deferred
  to the OTel build-out).
- **Lektionen** (all trainers, §H1/§I3): the teaching console — browse the content library (lectures
  are authored as markdown in repo-root `content/` by the linguist (Angelika) and imported at deploy; the portal
  never authors), assign to students (picker = the learner directory; drafts are visible but
  unassignable), and see the per-student outcome table (Offen | Begonnen | Erledigt, spanning all
  lecture versions; results link into the session drill-down). Rows show `Version {n}` +
  Content-Bibliothek provenance. Keys: `['staff-lectures'…]` / `['staff-lecture', id]` /
  `['staff-lecture-assignments', id]`.
- **Schüler** (all trainers, §H1.3/§H3): learner directory (`/students`; ACTIVE family accounts only —
  pending/deactivated students stay out of the directory and the assign picker) → per-student detail
  with the progress header, the **Zuweisungen** list (incl. never-started OPEN assignments), and the
  day-grouped activity timeline (filter by source; durations are `activeMs` engagement time, never wall
  clock) → question-by-question session drill-down (`/students/:profileId/sessions/:sessionId`).
- ADMIN surface: **Nutzer** (approve/deactivate/delete + per-student learner progress + email search).
Identity note: the ADMIN user administration shows real parent emails by design; trainer surfaces never do.

## Definition of done for a feature
Renders from backend JSON; shows no account-identifying data (parent email/billing) outside Nutzer;
claim/verdict flow maps backend status codes to the right UI (incl. `409`); types still match the generated
contract (`gen:api` drift-clean); desktop/tablet layout holds at typical tablet widths.
