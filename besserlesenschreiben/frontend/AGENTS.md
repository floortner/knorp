# AGENTS.md — frontend (`-web`)

Instructions for AI coding agents (Claude Code) working in this folder. Read this **first**, then
`../ARCHITECTURE.md`, then `./SPEC.md`. On any conflict, `../ARCHITECTURE.md` wins.

## What this is
The SPA / PWA for an adaptive German literacy tutor for students (ages 8-14). It's a **pure HTTP client** — it holds no
business logic about *what* to drill, only *how* to render exercises the backend serves and how to report
what happened. Screens are iterated separately in Claude Design; this code defines structure + data flow.

## Stack (pinned lines — see ARCHITECTURE §2)
Node 24 LTS · TypeScript 5.x · React 19.2.x · Vite 8.1.x (+ @vitejs/plugin-react 6) · Tailwind CSS 4.3.x
(CSS-first `@theme`, `@tailwindcss/vite`) · shadcn/ui · @tanstack/react-query 5.x · React Router 7 ·
vite-plugin-pwa (Workbox). Fonts: Atkinson Hyperlegible (body) + Bricolage Grotesque (display).

## Read order before coding
1. `./SPEC.md` §3 (the `Exercise` union + renderers — currently a single `placeholder` stand-in type; the
   Vokaltraining content set was dropped, ROADMAP.md §F) and §4 (telemetry).
2. `../ARCHITECTURE.md` §4 (API rules), §5 (errors → UI behaviour), §10 (SVG-first media).

## Golden rules (do not violate)
1. **Mirror the backend contract exactly.** `src/lib/api.gen.ts` is **generated from the backend OpenAPI**
   (`npm run gen:api`, `openapi-typescript`) and committed — **never hand-edit it**. Change the backend Zod
   schema, re-export `openapi.json`, then regenerate. CI fails on any drift. `features/exercises/types.ts` and
   `lib/api.ts` (the hand-written transport wrapper) must stay in lockstep with `../backend/SPEC.md §6`.
2. **`lib/api.ts` is transport only** — no JSX, no UI. Components never hand-roll fetch or error parsing.
3. **Every answered item emits exactly one `/attempts` call** with a real `timeMs` (start timer on item mount,
   stop on answer). Fire-and-forget; queue + retry offline; never block the student's UI on the network (SPEC §4).
4. **No hardcoded lesson data.** Render every type in the current contract from backend-served JSON.
5. **The app is free — no payment UI, ever** (ARCHITECTURE §1b/§9). Never show a price, paywall, or buy button
   anywhere; nothing emits or handles `402`. ★ ops are daily-capped server-side — a `429 RATE_LIMITED` carries a
   kindgerechte message and surfaces through the normal error paths.
6. **SVG-first media** (ARCHITECTURE §10): all app art/icons/mascots/badges are SVG. **Sanitize any
   non-hand-authored SVG** (LLM-generated/uploaded) with DOMPurify before inlining — never
   `dangerouslySetInnerHTML` on raw SVG. Homework photo is the only raster, handled by the backend.
7. **Accessibility is a feature, not a polish step.** `dyslexicFont`, `fontScale`, `soundOn` from settings must
   visibly work; large tap targets; keyboard operable.

## Conventions
- Mobile-first: design at ~390px, scale up. The student user needs big targets and calm feedback.
- TanStack Query for ALL server state; keys `['me']`,`['units']`,`['session',id]`,`['progress',pid]`,
  `['chat',pid]`. Invalidate `['me']`+`['progress']`+`['units']` after `/sessions/{id}/complete`.
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

## Build milestones
Shipped milestones and the forward plan live in the repo-root **[`ROADMAP.md`](../../ROADMAP.md)** — the
single source of truth. Everything through Phase 2.5 + Post-2.5 is done and the beta is live (§E); the
Vokaltraining content set (14-type exercise set, 7-unit progression, ~360 seed items) was dropped 2026-07-13
and is being redesigned from scratch (§F) — the exercise contract currently holds a single `placeholder`
stand-in type. No billing — the app is free.

## Definition of done for a feature
Renders from backend JSON; one `/attempts` per answer with sane timing; error codes map to the right UI;
no paywall reachable from student tabs; a11y toggles work; types still match the generated OpenAPI.
