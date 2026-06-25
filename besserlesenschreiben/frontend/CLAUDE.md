# CLAUDE.md

> Auto-loaded by Claude Code. **Read `./AGENTS.md` first**, then `../ARCHITECTURE.md`, then `./SPEC.md`.
> On any conflict, `../ARCHITECTURE.md` wins.

This folder is the **`-web` frontend** of *besserlesenschreiben* — the SPA/PWA for an adaptive German
children's literacy tutor. It is a **pure HTTP client**: it renders the exercises the backend serves and
reports what happened. No lesson logic lives here.

## Contents

- **`docs/knorp.html`** — the interactive design prototype. **Visual + interaction source of truth.** Open it in a
  browser to see every screen, the 12 exercise interactions, feedback, and the brand. **Recreate** it in the real
  stack (React + TS + Tailwind + shadcn) — do **not** paste the prototype's HTML/inline styles into the app.
- **`fixtures/`** — golden example API payloads (`session.example.json` = all 12 exercise types;
  `units.example.json` = the 7 units + theme colors). Build renderers and snapshot tests against these.
- **`docs/screens/`** — a screenshot of each screen, as a quick visual index.
- **`monster-pets/`** — SVG mascot characters (Nepo, Stella, and others) in four emotional states each
  (`froehlich`, `traurig`, `cool`, `ueberrascht`).
- **`SPEC.md`** — the contract: screen map, the 12-type `Exercise` union, telemetry, API endpoints, a11y.
- **`AGENTS.md`** — the golden rules you must not violate.

## The one thing that matters most

Every answered item emits **exactly one `/attempts`** call with a real `timeMs`. Telemetry is the product's
spine — see `SPEC.md` §4. The 12 renderers + telemetry are the bulk of the work (`SPEC.md` §3, milestone 4).

## Prototype vs spec (what to copy vs build fresh)

- **In the prototype** (recreate the look/interactions): login + code entry, onboarding, `/lernen` home,
  the 12 exercise renderers, feedback/confetti, `/liga`, `/profil`, `/chat`, parent PIN gate + trainer actions,
  a11y toggles.
- **Spec-only, NOT in the prototype** (build from `SPEC.md`, no visual reference yet — match the brand):
  the parent **billing/supporter** section (§8) and the **homework "Foto & verbessern"** flow (§9).
  Both are parent-area only, behind the PIN. Never surface payment in the child tabs.

## Brand quick-reference

- Primary teal **#27A99B**, accent orange **#F0915F**, warm canvas **#FCF7EF**, ink **#27403C**.
- Per-unit theme colors live in `fixtures/units.example.json` (`theme.iconBg` / `theme.iconColor`).
- Fonts: **Atkinson Hyperlegible** (body) + **Bricolage Grotesque** (display).
- Mobile-first at ~390px, large tap targets, calm feedback.

## The 12 exercise types at a glance

All render from backend JSON (`fixtures/session.example.json` has one of each). Discriminated union on `type`
— full shapes in `SPEC.md` §3.

- **Single-choice** (tap one option → correct/wrong): `count`, `gap`, `rhyme`, `initial`, `letter`, `case`,
  `nonsense`, `bd`, `vowel`.
- **Tile-order** (tap tiles in sequence; compare to `syll.join('|')`; reset button): `order`, `arrange`.
- **Pair-match** (tap two tiles; correct if both in `pair`): `pairs`.

State machine per item: `idle → correct | wrong`. On correct: chime + speak the word + show `praise`, advance.
On wrong: buzz + "Nochmal versuchen", allow retry (increment `attemptNo`). Confetti on session complete.

## Suggested first prompt for Claude Code

> Read `CLAUDE.md`, then `AGENTS.md`, then `../ARCHITECTURE.md`, then `SPEC.md`. Open `docs/knorp.html` to see
> the target design and interactions. We're building milestone 1 from `SPEC.md` §11: app shell + routing +
> bottom tab nav + `lib/api.ts` + the email-code auth screens. **Recreate** the prototype's look in React +
> TypeScript + Tailwind + shadcn/ui — do not paste the prototype HTML. Render against `fixtures/` where
> relevant. Stop after the shell so we can review.

Drive it milestone by milestone (`SPEC.md` §11). The 12 renderers + telemetry (milestone 4) are ~half the
work — give that its own focused sessions, one or two exercise types at a time, each with a golden snapshot
test against `fixtures/session.example.json`.
