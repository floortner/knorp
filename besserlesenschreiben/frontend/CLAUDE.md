# CLAUDE.md

> Auto-loaded by Claude Code. **Read `./AGENTS.md` first**, then `../ARCHITECTURE.md`, then `./SPEC.md`.
> On any conflict, `../ARCHITECTURE.md` wins.

This folder is the **`-web` frontend** of *besserlesenschreiben* — the SPA/PWA for an adaptive German
literacy tutor for students (ages 8-14). It is a **pure HTTP client**: it renders the exercises the backend serves and
reports what happened. No lesson logic lives here.

## Contents

- **`docs/knorp.html`** — the interactive design prototype. Visual source of truth for the **shell, screens
  and brand** (login, onboarding, tabs, feedback). Its parent area/PIN gate was removed from the app
  (2026-07-22 — those trainer actions now live in `/profil` behind a two-step confirmation). Its exercise interactions document a legacy
  type set that predates even the (now also dropped) Vokaltraining program — the current `Exercise` contract
  lives in `SPEC.md` §3 and the built renderers, not in the prototype. **Recreate** looks in the real stack
  (React + TS + Tailwind + shadcn) — do **not** paste the prototype's HTML/inline styles into the app.
- **`fixtures/`** — golden example API payloads (`session.example.json`, `units.example.json`). The
  Vokaltraining content set (14 exercise types, 7 units) was dropped 2026-07-13 (ROADMAP.md §F) — these
  currently hold a single stand-in `placeholder` exercise and an empty units array. Build renderers and
  snapshot tests against these.
- **`docs/screens/`** — a screenshot of each screen, as a quick visual index.
- **`monster-pets/`** — SVG mascot characters (Nepo, Stella, and others) in four emotional states each
  (`froehlich`, `traurig`, `cool`, `ueberrascht`).
- **`SPEC.md`** — the contract: screen map, the `Exercise` union, telemetry, API endpoints, a11y.
- **`AGENTS.md`** — the golden rules you must not violate.

## The one thing that matters most

Every answered item emits **exactly one `/attempts`** call with a real `timeMs`. Telemetry is the product's
spine — see `SPEC.md` §4. Telemetry plumbing was built before the renderers — together the bulk of the work
(`SPEC.md` §3).

## Prototype vs spec (what to copy vs build fresh)

- **In the prototype** (recreate the look/interactions): login + code entry, onboarding, `/lernen` home,
  feedback/confetti, `/liga`, `/profil`, `/chat`, a11y toggles. (The prototype's parent PIN gate is
  obsolete — reset/chat-delete live in `/profil` behind a two-step confirmation.)
- **Spec-only, NOT in the prototype** (build from `SPEC.md` — match the brand and the existing renderer
  patterns): the exercise type(s) in the current `Exercise` contract (the prototype shows only the legacy
  set); the ✨ **generated-lecture entry** on `/lernen` + the lesson **intro card** (§2) and the **homework
  "Foto & verbessern"** flow (§9). The app is **free** — no billing/supporter UI anywhere (ARCHITECTURE §9).
  **Homework upload lives in the student Chat tab** (`tabs/Chat.tsx`): the photo is sent as a chat message and
  the reviewer's verdict is echoed back in-chat. The professional-in-the-loop model
  is unchanged (the photo still goes to the pseudonymised staff queue; the LLM never auto-applies it).

## Brand quick-reference

- Primary teal **#27A99B**, accent orange **#F0915F**, warm canvas **#FCF7EF**, ink **#27403C**.
- Per-unit theme colors live in `fixtures/units.example.json` (`theme.iconBg` / `theme.iconColor`).
- Fonts: **Atkinson Hyperlegible** (body) + **Bricolage Grotesque** (display).
- Mobile-first at ~390px, large tap targets, calm feedback.

## The exercise contract at a glance

The Vokaltraining 14-type program (Wortraster, kurz/lang-Vokal, Quatschwörter, Komposita, Wortfamilien) was
dropped 2026-07-13 (ROADMAP.md §F) — training types, sequence, and word lists are being redesigned from
scratch. The contract currently holds a single stand-in type:

- **`placeholder`** — single-choice (tap one option → correct/wrong), rendered via the generic
  `SingleChoiceExercise`. `fixtures/session.example.json` has the one example.

The reusable scaffolding survives the drop: `ExerciseCard`/`ChoiceTile`/`useAnswer` (the answer state
machine), `SingleChoiceExercise`, and `ExerciseView.tsx`'s type dispatch. The content-specific renderers
(Wortraster grid, syllable-tile reorder, sentence-token tap) were deleted with their types — add new ones
back via `ExerciseView.tsx`'s dispatch as new training types are designed (ROADMAP.md §C2 has the playbook).

State machine per item: `idle → correct | wrong`. On correct: chime + speak the answer + show `praise`,
advance. On wrong: buzz + "Nochmal versuchen", allow retry (increment `attemptNo`). Confetti on session
complete.

## Suggested first prompt for Claude Code

> Read `CLAUDE.md`, then `AGENTS.md`, then `../ARCHITECTURE.md`, then `SPEC.md`. Open `docs/knorp.html` to see
> the target design and interactions. We're building the first milestone in `../../ROADMAP.md`: app shell + routing +
> bottom tab nav + `lib/api.ts` + the email-code auth screens. **Recreate** the prototype's look in React +
> TypeScript + Tailwind + shadcn/ui — do not paste the prototype HTML. Render against `fixtures/` where
> relevant. Stop after the shell so we can review.

Drive it milestone by milestone (`../../ROADMAP.md`). Build the telemetry pipeline first, then the
exercise renderers — give each new training type its own focused session, one or two at a time, each with
a golden snapshot test against `fixtures/session.example.json` (currently just `placeholder` — see
ROADMAP.md §F/§C2 for the content-redesign plan).
