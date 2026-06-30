# AGENTS.md — reviewer portal (`-review`)

Instructions for AI coding agents (Claude Code) working in this folder. Read this **first**, then
`../ARCHITECTURE.md` (§1a + §11 especially), then `../backend/SPEC.md` §6 (staff routes) + §10. On any
conflict, `../ARCHITECTURE.md` wins.

## What this is
The **internal staff portal** for **professional homework review**. A vetted literacy professional opens a
pending homework photo with its **LLM draft analysis**, validates/corrects it, and approves/rejects. Their
verdict is **authoritative** and feeds the child's next lecture (ARCHITECTURE §11). It is a **pure HTTP
client** over the backend `staff/` routes — it holds **no business logic** (queue ordering, who may review,
the authoritative-apply step all live in the backend).

This app is **internal-only**: ~3 hand-provisioned staff, never shipped to families, `noindex`.

## The two things that matter most
1. **This is the staff realm, not the family realm (ARCHITECTURE §1a).** Auth is the staff httpOnly cookie
   (`credentials:'include'`); there is **no token in JS**. Never import or reuse anything from the `-web`
   family app's auth. A family JWT must never work here and vice-versa (the backend enforces it; don't
   undermine it client-side).
2. **Minimise what you show (pseudonymisation).** The queue and review screens may show only: the homework
   **image**, the **LLM draft**, **skill tags**, and a **grade band**. **Never** render or request a child's
   name, the parent email, chat, billing, or any direct identifier — the backend won't send them; don't add a
   call that asks for them.

## Stack (matches `-web`; see ARCHITECTURE §2)
Node 24 LTS · TypeScript 5.x · React 19.2.x · Vite 8.1.x (+ @vitejs/plugin-react 6) · Tailwind CSS 4.3.x
(CSS-first `@theme`) · @tanstack/react-query 5.x · React Router 7 · Vitest + Testing Library.
**No PWA** (staff are online on desktop/tablet) and **no child fonts/mascots** — this is a calm, neutral,
information-dense tool.

## Form factor (deliberate)
**Desktop/laptop + tablet, landscape. NOT mobile-first.** The review screen is a **two-pane** layout
(homework image | editable analysis). Don't spend effort on narrow-phone layouts — that's the family app's
job. Comfortable tap targets for tablet are welcome.

## Golden rules (do not violate)
1. **`lib/api.ts` is transport only** — no JSX, no UI. Screens never hand-roll `fetch` or error parsing.
2. **Contract types are GENERATED, never hand-authored.** `lib/api.gen.ts` comes from the backend's
   published `/staff/*` OpenAPI via `npm run gen:api` (committed; CI drift-gates it) — never edit it.
   `lib/contract.ts` only re-exports ergonomic aliases over the generated `operations` (the `-web`
   `lib/types.ts` pattern). After any backend staff-contract change: re-export `openapi.json`, run
   `gen:api`, commit both. Keep the exported type names stable.
3. **The reviewer verdict is authoritative; the LLM output is a draft.** The UI seeds the editor from
   `llmAnalysis` and submits the (possibly corrected) copy as `reviewedAnalysis`. `approved` = unchanged,
   `corrected` = edited, `rejected` = unreadable/not-homework (sends no analysis). Don't apply anything
   locally — the backend does the authoritative write.
4. **Claim before you edit.** Entering a review soft-locks the item (`POST /staff/queue/{id}/claim`); a `409`
   means another reviewer holds it — surface that, don't fight it.
5. **One error envelope (ARCHITECTURE §5).** `ApiError.code` is the stable switch; never parse `message`.
   `401/SESSION_EXPIRED` clears auth and redirects to `/login` once.

## Conventions
- TanStack Query for ALL server state; keys: `['staff-me']`, `['staff-queue']`.
- Auth state is derived from a `/staff/me` probe (survives refresh); see `features/auth/`.
- Brand accent is teal (shared), but the surface is neutral slate/white — see `src/index.css` `@theme`.
- German UI copy (the staff are German/Austrian).

## Commands
- Install: `npm install`  ·  Dev: `npm run dev`  ·  Build: `npm run build` (tsc -b + vite)
- Lint: `npm run lint`  ·  Test: `npm test` (Vitest)  ·  Types from API: `npm run gen:api` (once `/staff/*` exists)

## Build order (backend SPEC §12, Phase 2.5 — milestone 13)
- **a. Shell + staff auth** (DONE in scaffold): app shell, `lib/api.ts`, email-code login, `/staff/me` gate, logout.
- **b. Queue screen** (DONE in scaffold): pseudonymised list, claim on open.
- **c. Review screen** (DONE in scaffold): two-pane image | editable draft, approve/correct/reject.
Next: wire to the real backend `/staff/*` once it lands; regenerate types; add golden/flow tests per screen.

## Definition of done for a feature
Renders from backend JSON; shows no child-identifying data; claim/verdict flow maps backend status codes to
the right UI (incl. `409`); types still match the generated contract (`gen:api` drift-clean); desktop/tablet layout
holds at typical tablet widths.
