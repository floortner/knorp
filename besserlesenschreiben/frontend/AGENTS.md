# AGENTS.md — frontend (`-web`)

Instructions for AI coding agents (Claude Code) working in this folder. Read this **first**, then
`../ARCHITECTURE.md`, then `./SPEC.md`. On any conflict, `../ARCHITECTURE.md` wins.

## What this is
The SPA / PWA for an adaptive German children's literacy tutor. It's a **pure HTTP client** — it holds no
business logic about *what* to drill, only *how* to render exercises the backend serves and how to report
what happened. Screens are iterated separately in Claude Design; this code defines structure + data flow.

## Stack (pinned lines — see ARCHITECTURE §2)
Node 24 LTS · TypeScript 5.x · React 19.2.x · Vite 8.1.x (+ @vitejs/plugin-react 6) · Tailwind CSS 4.3.x
(CSS-first `@theme`, `@tailwindcss/vite`) · shadcn/ui · @tanstack/react-query 5.x · React Router 7 ·
vite-plugin-pwa (Workbox). Fonts: Atkinson Hyperlegible (body) + Bricolage Grotesque (display).

## Read order before coding
1. `./SPEC.md` §3 (the 17 exercise renderers + the `Exercise` union) and §4 (telemetry).
2. `../ARCHITECTURE.md` §4 (API rules), §5 (errors → UI behaviour), §10 (SVG-first media).

## Golden rules (do not violate)
1. **Mirror the backend contract exactly.** `src/lib/api.gen.ts` is **generated from the backend OpenAPI**
   (`npm run gen:api`, `openapi-typescript`) and committed — **never hand-edit it**. Change the backend Zod
   schema, re-export `openapi.json`, then regenerate. CI fails on any drift. `features/exercises/types.ts` and
   `lib/api.ts` (the hand-written transport wrapper) must stay in lockstep with `../backend/SPEC.md §6`.
2. **`lib/api.ts` is transport only** — no JSX, no UI. Components never hand-roll fetch or error parsing.
3. **Every answered item emits exactly one `/attempts` call** with a real `timeMs` (start timer on item mount,
   stop on answer). Fire-and-forget; queue + retry offline; never block the child's UI on the network (SPEC §4).
4. **No hardcoded lesson data.** Render all 17 types from backend-served JSON.
5. **Payments/paywalls are parent-area only, behind the PIN.** A `402` from the API routes the **parent** to the
   supporter screen — never show a price, paywall, or buy button in the child tabs.
6. **SVG-first media** (ARCHITECTURE §10): all app art/icons/mascots/badges are SVG. **Sanitize any
   non-hand-authored SVG** (LLM-generated/uploaded) with DOMPurify before inlining — never
   `dangerouslySetInnerHTML` on raw SVG. Homework photo is the only raster, handled by the backend.
7. **Accessibility is a feature, not a polish step.** `dyslexicFont`, `fontScale`, `soundOn` from settings must
   visibly work; large tap targets; keyboard operable.

## Conventions
- Mobile-first: design at ~390px, scale up. The child user needs big targets and calm feedback.
- TanStack Query for ALL server state; keys `['me']`,`['units']`,`['session',id]`,`['progress',pid]`,
  `['chat',pid]`,`['billing']`. Invalidate `['me']`+`['progress']`+`['units']` after `/sessions/{id}/complete`.
- Auth: the backend's **httpOnly session cookie** is the source of truth (`credentials:'include'`); auth state
  is derived from a `/me` probe — never put a token in localStorage/JS.
- Wrap risky subtrees in the `ErrorBoundary` (whole app + the `LessonRunner`); a renderer throw must never
  blank the app. `ExerciseView` throws on an unknown type so the boundary catches it.
- Voice: play `audioUrl` if present, else Web Speech fallback (`de-DE`); respect `soundOn`.
- A `401/SESSION_EXPIRED` clears auth and redirects once (no loops).

## Commands (create these as you scaffold)
- Install: `npm install`   ·   Dev: `npm run dev`   ·   Build: `npm run build`
- Test: `npm test` (include **golden** snapshot tests for the `Exercise` rendering contract)
- Types from API: `npm run gen:api` (openapi-typescript against the backend OpenAPI)

## Build milestones (SPEC §11)
Phase 1 (shell/auth/onboarding/home/telemetry/12 renderers/progress) + Phase 1.5 (error boundary, offline
caching, telemetry retention, query fixes, committed `api.gen.ts` + drift gate, flow tests) + Phase 1.6
(content + UX polish: unit unlock, all-done celebration, 5 new exercise renderers → 17 total, parent area,
profile tab) are **done**. Next is Phase 2: chat (★ LLM), then the parent billing/supporter + homework flow
(parent-area only).

## Definition of done for a feature
Renders from backend JSON; one `/attempts` per answer with sane timing; error codes map to the right UI;
no paywall reachable from child tabs; a11y toggles work; types still match the generated OpenAPI.
