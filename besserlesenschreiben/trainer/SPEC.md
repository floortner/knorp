# SPEC — besserlesenschreiben **Trainer-Portal**

The internal **staff portal** (`-trainer`): professional homework review plus the trainer's teaching
console (lectures, learner directory + activity). A **pure HTTP client** over the backend's `/staff/*`
routes — no business logic lives here (queue ordering, authoritative apply, activity rollups are all
backend concerns, `../backend/SPEC.md` §6/§10).

> **Governed by `../ARCHITECTURE.md`** (§1a auth realms, §11 professional-in-the-loop, §5 errors).
> Read `./AGENTS.md` first, then `../ARCHITECTURE.md`, then this file. On any conflict, ARCHITECTURE
> wins. Internal-only: ~3 hand-provisioned staff, never shipped to families, `noindex`.

---

## 1. Stack & form factor

- **Vite + React 19 + TypeScript** SPA; Tailwind 4 (CSS-first `@theme`, neutral slate surface, teal
  accent); TanStack Query 5; React Router 7; Vitest + Testing Library. Pinned lines: ARCHITECTURE §2.
- **Desktop/laptop + tablet, landscape — NOT mobile-first.** The review screen is a two-pane layout
  (image | analysis). No PWA, no service worker, no student fonts/mascots.
- **German UI copy**, emoji-free; icons from **lucide-react only**, the same icon for the same concept
  everywhere. Raw wire-enum values never reach the UI (`lib/decision.ts` maps them).
- Dev server port **5174** (`vite.config.ts` `strictPort` — 5173 belongs to the family app).

## 2. Screen map

```
/login            staff email → code entry (no staff-enumeration; backend always 200s)
/queue            "Chats": review pipeline (Offen | Erledigt | Alle), cursor-paged, student names,
                  waiting-since cue, "in Prüfung" claim locks; nav badge = open total
  └ /review/:uploadId    two-pane review (image lightbox | editable AnalysisEditor), claim on entry,
                         approve/correct/reject-with-confirm, submit → next open item; deep-link safe
                         (direct GET /staff/queue/{id}); already-decided → hands over to /history
  └ /history/:uploadId   read-only detail of a DECIDED review (verdict, analysis, student comment)
/lectures         "Lektionen": content-library browse (current versions; drafts visible, unassignable)
  └ /lectures/:lectureId    Merksatz + items read-only, assign dialog (searchable, full directory),
                            per-student outcome table across all versions of the slug
/students         "Schüler": learner directory — name-ordered, ACTIVE family accounts only, count +
                  per-row teaser (Einheit, weakest skills, last active, 7d/30d sessions, streak, attempts)
  └ /students/:profileId    progress header (ProgressPanel) + Zuweisungen (incl. never-started OPEN
                            assignments) + day-grouped activity timeline (source filter; durations are
                            activeMs engagement time, never wall clock)
      └ /sessions/:sessionId    question-by-question drill-down (answer order, per-attempt timing)
/users            ADMIN-only "Nutzer": account approve/deactivate/delete (identity-bearing — real
                  parent emails), pending badge, email search, per-student progress
/profile          "Profil": the trainer's OWN account — rename self; email/role/access date read-only
                  (admin-provisioned); build-version stamp
```

**Nav** (top bar): `Chats · Lektionen · Schüler · (Nutzer, admin only) · Profil` + logout. The Nutzer
link, its badge query, and the screen itself are all admin-gated client-side; the backend enforces
`role='admin'` regardless (rule 8).

## 3. Data flow

Transport: `lib/api.ts` (staff httpOnly cookie via `credentials:'include'`, no token in JS, one error
envelope → `ApiError`). Types: `lib/api.gen.ts` **generated** from the backend OpenAPI (`npm run
gen:api`, committed, CI drift-gated), aliased ergonomically in `lib/contract.ts` — never hand-author a
wire shape. Wrappers: `lib/endpoints.ts` (`staffAuthApi`, `reviewApi`, `studentsApi`, `lecturesApi`,
`usersApi`).

Endpoints consumed (shapes in `../backend/SPEC.md` §6):

```
POST /staff/auth/request-code   POST /staff/auth/verify   POST /staff/auth/logout
GET  /staff/me                  PATCH /staff/me
GET  /staff/queue               GET  /staff/queue/{id}    GET  /staff/queue/{id}/progress
POST /staff/queue/{id}/claim    POST /staff/queue/{id}/release    POST /staff/reviews/{id}
GET  /staff/students            GET  /staff/students/{id}         GET  /staff/students/{id}/assignments
GET  /staff/students/{id}/sessions        GET  /staff/students/{id}/sessions/{sessionId}
GET  /staff/lectures            GET  /staff/lectures/{id}
POST /staff/lectures/{id}/assignments     GET  /staff/lectures/{id}/assignments
DELETE /staff/lectures/{id}/assignments/{aid}
GET  /staff/users               POST /staff/users/{id}/approve    POST /staff/users/{id}/deactivate
DELETE /staff/users/{id}        GET  /staff/users/{id}/progress                       # admin only
```

Query-key prefixes (mutations invalidate by prefix): `['staff-me']` · `['staff-queue', …]` (`'list'`,
`'count'`, `'item'`) · `['staff-queue-progress', id]` · `['staff-students']` / `['staff-student…', …]`
· `['staff-lecture…', …]` · `['staff-users', …]`. Queue list + badge refetch on a 30 s interval (small
shared staff pool). A `401/SESSION_EXPIRED` anywhere clears the cached `['staff-me']` identity AND
redirects to `/login` once (`ApiErrorBridge`); logout `qc.clear()`s the whole cache (shared machines).

## 4. Review flow rules (the core — ARCHITECTURE §11)

1. **Claim before editing** (`POST …/claim`); a `409` renders the read-only "nur Ansicht" banner —
   never fight another trainer's lease. Leaving without a verdict releases the own claim
   (fire-and-forget `…/release`).
2. **The LLM output is a draft; the trainer's verdict is authoritative.** The editor seeds from
   `llmAnalysis`; submit maps `dirty ? 'corrected' : 'approved'` with the edited copy as
   `reviewedAnalysis`. **Reject** is confirm-gated and sends **no** analysis (applies nothing).
3. Decided items are immutable history: `/history/:uploadId` is read-only; a `/review` deep link to a
   decided item hands over to it. Rejected history shows the draft labeled "abgelehnt — nichts wurde
   übernommen".
4. Async — nothing here ever blocks a student.

## 5. Data minimisation (rule 10 — known-trainer model)

Trainer surfaces show the student's **name + learning data** (the 2–3 trainers know each student
personally) and never a parent email, chat text, or billing. Account identity/lifecycle is the
admin-only Nutzer surface (rule 8). Don't add a call that asks for more; the backend won't send it.
The learner directory and assign picker list students of **active** family accounts only.

## 6. Env & build

```
VITE_API_BASE=        # backend URL incl. /api/v1 (required for production builds)
```
- `VITE_APP_VERSION` is injected at build by `vite.config.ts` (`<package version>+<commit>`; deploy
  sets `GIT_COMMIT`) and shown on `/profile` — mirrors backend `/health`.
- `npm run dev` (:5174, strict) · `build` (`tsc -b && vite build`) · `test` · `lint` · `gen:api`.
- CI (`.github/workflows/ci.yml` `trainer` job): `lint · tsc -b · build · test · gen:api` + the
  `api.gen.ts` drift gate.

## 7. Acceptance checks

- Every screen renders from backend JSON; no hand-authored wire shape compiles.
- Claim/verdict flow maps backend status codes to the right UI (incl. `409` read-only takeover), and
  reject is never one-tap. Deep links to review/history items resolve regardless of queue depth.
- No parent email/chat/billing reachable outside the admin-gated Nutzer surface; a plain trainer
  never sees the Nutzer nav item and its queries never fire.
- A `401` on any call flips the SPA to anonymous immediately (no stale cached identity).
- German copy throughout; no emoji; no raw enum values (`pending_review` etc.) visible.
- Layout holds at typical tablet-landscape widths (≥1024 px keeps the two-pane review side by side).
