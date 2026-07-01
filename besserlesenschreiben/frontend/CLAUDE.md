# CLAUDE.md

> Auto-loaded by Claude Code. **Read `./AGENTS.md` first**, then `../ARCHITECTURE.md`, then `./SPEC.md`.
> On any conflict, `../ARCHITECTURE.md` wins.

This folder is the **`-web` frontend** of *besserlesenschreiben* — the SPA/PWA for an adaptive German
children's literacy tutor. It is a **pure HTTP client**: it renders the exercises the backend serves and
reports what happened. No lesson logic lives here.

## Contents

- **`docs/knorp.html`** — the interactive design prototype. **Visual + interaction source of truth.** Open it in a
  browser to see every screen, the original 12 exercise interactions, feedback, and the brand (the 5 types added in
  Phase 1.6 — `swipe`, `odd`, `listen`, `sentence`, `build` — are **not** in the prototype). **Recreate** it in the
  real stack (React + TS + Tailwind + shadcn) — do **not** paste the prototype's HTML/inline styles into the app.
- **`fixtures/`** — golden example API payloads (`session.example.json` = all 17 exercise types;
  `units.example.json` = the 7 units + theme colors). Build renderers and snapshot tests against these.
- **`docs/screens/`** — a screenshot of each screen, as a quick visual index.
- **`monster-pets/`** — SVG mascot characters (Nepo, Stella, and others) in four emotional states each
  (`froehlich`, `traurig`, `cool`, `ueberrascht`).
- **`SPEC.md`** — the contract: screen map, the 17-type `Exercise` union, telemetry, API endpoints, a11y.
- **`AGENTS.md`** — the golden rules you must not violate.

## The one thing that matters most

Every answered item emits **exactly one `/attempts`** call with a real `timeMs`. Telemetry is the product's
spine — see `SPEC.md` §4. Telemetry plumbing is its own milestone (4), built before the 17 renderers
(milestone 5) — together the bulk of the work (`SPEC.md` §3).

## Prototype vs spec (what to copy vs build fresh)

- **In the prototype** (recreate the look/interactions): login + code entry, onboarding, `/lernen` home,
  the original 12 exercise renderers, feedback/confetti, `/liga`, `/profil`, `/chat`, parent PIN gate + trainer
  actions, a11y toggles.
- **Spec-only, NOT in the prototype** (build from `SPEC.md`, no visual reference yet — match the brand and the
  existing renderer patterns): the 5 Phase-1.6 exercise types (`swipe`, `odd`, `listen`, `sentence`, `build`);
  the ✨ **generated-lecture entry** on `/lernen` + the lesson **intro card** (§2) and the **homework
  "Foto & verbessern"** flow (§9). The app is **free** — no billing/supporter UI anywhere (ARCHITECTURE §9);
  homework upload is parent-area only, behind the PIN.

## Brand quick-reference

- Primary teal **#27A99B**, accent orange **#F0915F**, warm canvas **#FCF7EF**, ink **#27403C**.
- Per-unit theme colors live in `fixtures/units.example.json` (`theme.iconBg` / `theme.iconColor`).
- Fonts: **Atkinson Hyperlegible** (body) + **Bricolage Grotesque** (display).
- Mobile-first at ~390px, large tap targets, calm feedback.

## The 17 exercise types at a glance

All render from backend JSON (`fixtures/session.example.json` has one of each). Discriminated union on `type`
— full shapes in `SPEC.md` §3.

- **Single-choice** (tap one option/word → correct/wrong): `count`, `gap`, `rhyme`, `initial`, `letter`, `case`,
  `nonsense`, `bd`, `vowel`, `odd` (tap the word that doesn't fit), `listen` (audio auto-plays, word hidden),
  `sentence` (tap the word in the sentence that fits the `instruction`).
- **Tile-order** (tap tiles in sequence; reset button): `order`, `arrange` (compare to `syll.join('|')`),
  `build` (spell the emoji's word; compare to `answer[]`).
- **Pair-match** (tap two tiles; correct if both in `pair`): `pairs`.
- **Swipe** (tap/swipe a card left or right; `answer` is `'left' | 'right'`): `swipe`.

State machine per item: `idle → correct | wrong`. On correct: chime + speak the word + show `praise`, advance.
On wrong: buzz + "Nochmal versuchen", allow retry (increment `attemptNo`). Confetti on session complete.

## Suggested first prompt for Claude Code

> Read `CLAUDE.md`, then `AGENTS.md`, then `../ARCHITECTURE.md`, then `SPEC.md`. Open `docs/knorp.html` to see
> the target design and interactions. We're building milestone 1 from `SPEC.md` §11: app shell + routing +
> bottom tab nav + `lib/api.ts` + the email-code auth screens. **Recreate** the prototype's look in React +
> TypeScript + Tailwind + shadcn/ui — do not paste the prototype HTML. Render against `fixtures/` where
> relevant. Stop after the shell so we can review.

Drive it milestone by milestone (`SPEC.md` §11). Build the telemetry pipeline (milestone 4) first, then the
17 renderers (milestone 5) — together ~half the work. Give the renderers their own focused sessions, one or
two exercise types at a time, each with a golden snapshot test against `fixtures/session.example.json`.
