# CLAUDE.md

> Auto-loaded by Claude Code. **Read `./AGENTS.md` first**, then `../ARCHITECTURE.md`, then `./SPEC.md`.
> On any conflict, `../ARCHITECTURE.md` wins.

This folder is the **`-web` frontend** of *besserlesenschreiben* — the SPA/PWA for an adaptive German
children's literacy tutor. It is a **pure HTTP client**: it renders the exercises the backend serves and
reports what happened. No lesson logic lives here.

## Contents

- **`docs/knorp.html`** — the interactive design prototype. Visual source of truth for the **shell, screens
  and brand** (login, onboarding, tabs, feedback, parent area). Its exercise interactions document the
  **legacy pre-Vokaltraining type set** — the current 14 exercise types live in `SPEC.md` §3 and the built
  renderers, not in the prototype. **Recreate** looks in the real stack (React + TS + Tailwind + shadcn) —
  do **not** paste the prototype's HTML/inline styles into the app.
- **`fixtures/`** — golden example API payloads (`session.example.json` = all 14 exercise types;
  `units.example.json` = the 7 Vokaltraining units + theme colors). Build renderers and snapshot tests
  against these.
- **`docs/screens/`** — a screenshot of each screen, as a quick visual index.
- **`monster-pets/`** — SVG mascot characters (Nepo, Stella, and others) in four emotional states each
  (`froehlich`, `traurig`, `cool`, `ueberrascht`).
- **`SPEC.md`** — the contract: screen map, the 14-type `Exercise` union, telemetry, API endpoints, a11y.
- **`AGENTS.md`** — the golden rules you must not violate.

## The one thing that matters most

Every answered item emits **exactly one `/attempts`** call with a real `timeMs`. Telemetry is the product's
spine — see `SPEC.md` §4. Telemetry plumbing was built before the renderers — together the bulk of the work
(`SPEC.md` §3).

## Prototype vs spec (what to copy vs build fresh)

- **In the prototype** (recreate the look/interactions): login + code entry, onboarding, `/lernen` home,
  feedback/confetti, `/liga`, `/profil`, `/chat`, parent PIN gate + trainer actions, a11y toggles.
- **Spec-only, NOT in the prototype** (build from `SPEC.md` — match the brand and the existing renderer
  patterns): **all 14 Vokaltraining exercise types** (the prototype shows only the legacy set);
  the ✨ **generated-lecture entry** on `/lernen` + the lesson **intro card** (§2) and the **homework
  "Foto & verbessern"** flow (§9). The app is **free** — no billing/supporter UI anywhere (ARCHITECTURE §9).
  **Homework upload lives in the child Chat tab** (`tabs/Chat.tsx`): the photo is sent as a chat message and
  the reviewer's verdict is echoed back in-chat — it is **not** PIN-gated. The professional-in-the-loop model
  is unchanged (the photo still goes to the pseudonymised staff queue; the LLM never auto-applies it).

## Brand quick-reference

- Primary teal **#27A99B**, accent orange **#F0915F**, warm canvas **#FCF7EF**, ink **#27403C**.
- Per-unit theme colors live in `fixtures/units.example.json` (`theme.iconBg` / `theme.iconColor`).
- Fonts: **Atkinson Hyperlegible** (body) + **Bricolage Grotesque** (display).
- Mobile-first at ~390px, large tap targets, calm feedback.

## The 14 exercise types at a glance (Vokaltraining)

All render from backend JSON (`fixtures/session.example.json` has one of each). Discriminated union on `type`
— full shapes in `SPEC.md` §3.

- **Single-choice** (tap one option → correct/wrong): `findvowel` (tap the Selbstlaut among the word's
  letters), `fixvowel` (Hend + a → Hand), `swapvowel` (ANY vowel in `answers` is correct), `insertvowel`
  (B_ch → u), `pickword` (the one real word in a row of vowel variants), `compound` (der/die/das from the
  Grundwort), `family` (which word belongs to the Wortfamilie).
- **Binary choice** (two labelled sides): `realword` (Echtes Wort/Quatschwort), `length` (kurz/lang),
  `sylvalid` (ja/nein — kann die Silbe klingen?), `paircheck` (gleich/anders).
- **Wortraster** (`raster`): grey line · yellow circle (the vowel = "die Sonne") · grey line; place the
  three shuffled parts.
- **Tile-order** (`sylarrange`): rebuild a multi-syllable word from shuffled syllable tiles; reset button.
- **Sentence** (`sentencefix`): tap the misspelled word; praise reveals the correction.

State machine per item: `idle → correct | wrong`. On correct: chime + speak the word + show `praise`, advance.
On wrong: buzz + "Nochmal versuchen", allow retry (increment `attemptNo`). Confetti on session complete.

## Suggested first prompt for Claude Code

> Read `CLAUDE.md`, then `AGENTS.md`, then `../ARCHITECTURE.md`, then `SPEC.md`. Open `docs/knorp.html` to see
> the target design and interactions. We're building the first milestone in `../../ROADMAP.md`: app shell + routing +
> bottom tab nav + `lib/api.ts` + the email-code auth screens. **Recreate** the prototype's look in React +
> TypeScript + Tailwind + shadcn/ui — do not paste the prototype HTML. Render against `fixtures/` where
> relevant. Stop after the shell so we can review.

Drive it milestone by milestone (`../../ROADMAP.md`). Build the telemetry pipeline first, then the
14 renderers — together ~half the work. Give the renderers their own focused sessions, one or
two exercise types at a time, each with a golden snapshot test against `fixtures/session.example.json`.
