# SPEC — besserlesenschreiben **Frontend**

The client SPA for the adaptive German literacy tutor. **Separate repo/folder** from the backend.
This app is a pure HTTP client — it holds no business logic about *what* to drill, only *how* to render
exercises the backend serves and how to report what happened. **Screens & interactions are iterated
separately in Claude Design; this spec defines structure, data flow, and the API contract it consumes.**

> **Governed by `../ARCHITECTURE.md`** (versions, API rules, errors, logging, hosting, media). Read `./AGENTS.md` first, then `../ARCHITECTURE.md`, then this file. On any conflict, ARCHITECTURE wins. The app is **free** — access is staff-approval-gated, and no payment UI exists anywhere (ARCHITECTURE §1b/§9).

---

## 1. Stack

- **Vite + React 19 + TypeScript** SPA (deliberately *not* Next.js — strict front/back separation; this is a client only). See `../ARCHITECTURE.md` §2 for pinned versions.
- **Tailwind CSS + shadcn/ui** for UI (responsive, mobile-first, accessible, components owned in-repo).
- **TanStack Query** for ALL server state (auth, profile, units, sessions, attempts, progress, chat).
- **React Router** for navigation.
- **PWA** (`vite-plugin-pwa`) — installable to the phone home screen, app-like.
- **Fonts:** Atkinson Hyperlegible (body, dyslexia-friendly) + Bricolage Grotesque (display) — already in the prototype.
- **No localStorage for the auth token** — prefer httpOnly cookie from backend; if header-based, keep token in memory + silent refresh.

Mobile-first: design at ~390px width first, scale up. Large tap targets (student users).

---

## 2. Screen map (ported from prototype `knorp.html`)

```
/login            email entry → 4-digit code entry → (session-expired state)
/onboarding       welcome (buddy intro) → choose buddy (8 Lernbuddies, Nepo default) → choose weekly goal
/app
  ├ /lernen       home: greeting, weekly goal ring, unit cards (title/subtitle/status, each with its
  │               own start), ✨ generated-lecture card, "Übung von {Trainer}" assignment cards
  │               (content-library lectures assigned by a trainer, §H1/§I — an offer, never a push;
  │               personal via the known-trainer name)
  │   └ /lesson   exercise runner (one renderer per contract type — §3), feedback, confetti on complete; sessions
  │               open with a teaching intro card (session.intro: mascot + Merksatz + "Los geht's!") —
  │               bank sessions carry the unit's Merksatz, generated lectures their own intro
  ├ /erfolge      achievement standing (Silber→Gold), stars this week, stars-to-next, weekly bars, monthly heatmap, streak
  ├ /profil       editable name, buddy picker, "aktiv seit", streak, stars, Ton toggle, login email,
  │               Verwaltung: reset progress + delete chat (destructive, two-step confirmation — §8),
  │               Abmelden, build-version stamp (ARCHITECTURE §7)
  └ /chat         message thread with trainer Angelika + input; 📷 homework upload — the photo shows as
  │               a chat message, the review status/verdict comes back as trainer bubbles (§9)
```

**Tabs** (bottom nav, mobile): `lernen · erfolge · chat · profil`. There is no separate parent area and no
PIN — the destructive actions live in `/profil` behind two-step confirmations.

**The app is free.** No price, paywall, or buy button exists anywhere — student or parent view. The ✨ lecture
card requests `POST /sessions {source:'llm'}` (loading state: generation takes a few seconds) and falls back
to a bank session with a friendly note when the LLM is unavailable (503).

---

## 3. Exercise renderers (the core)

The backend serves a `session` = ordered `Exercise[]`. Render one at a time. The source of truth is the
backend Zod union in `backend/src/contract/exercise.ts`. Each renderer: shows the prompt, captures the
answer, gives feedback, **emits telemetry**.

> The contract currently holds a single stand-in type; the real training types arrive with §F
> (HISTORY.md pivot log has the back-story). Add new types via `ExerciseView.tsx`'s dispatch as they're
> designed (ROADMAP.md §C2 has the playbook).

Discriminated union on `type` (currently):

```ts
type Exercise =
  | { type:'placeholder'; id; prompt:string; options:string[]; answer:string; praise } // single-choice stand-in
```

Each carries optional `audioUrl` (and `syllableAudio?`) for pre-generated voice, plus `skillTags`.

**Interaction pattern:** `placeholder` renders via the generic `SingleChoiceExercise` — tap one option →
correct/wrong. States: `idle | correct | wrong`. On correct: chime + speak the answer + `praise`, advance.
On wrong: buzz + "Nochmal versuchen", allow retry. Confetti/fanfare on session complete. This state machine
and the `ExerciseCard`/`ChoiceTile`/`useAnswer` scaffolding are the reusable base for the §F training types.

---

## 4. Telemetry — emit one attempt per answered item

**This is the product's spine.** Every renderer must time and report each answer.

```ts
// start a timer when the item mounts/becomes visible — it counts only VISIBLE time (§J5.1):
// createActiveTimer() (features/exercises/active-timer.ts) pauses on visibilitychange, so a
// backgrounded tab or locked phone never inflates timeMs (backend aggregations winsorize too)
const timer = createActiveTimer();
timer.restart();

// Derive prompt + expected per type (see features/exercises/derive.ts — pure and total over the union).
// The backend stores both columns NOT NULL, so never emit undefined. Currently: placeholder → prompt =
// ex.prompt, expected = ex.answer. Grow this switch as new training types are added (ROADMAP.md §F/§C2).
const { prompt, expected } = promptAndExpected(ex);

// on answer:
postAttempt({
  sessionId,
  itemId: ex.id,
  exerciseType: ex.type,
  prompt,
  expected,
  given: String(chosen),
  isCorrect,
  timeMs: Math.round(performance.now() - startedAt),
  attemptNo,             // increment on retry of same item
  skillTags: ex.skillTags ?? [],
});
```

- Fire-and-forget via the telemetry queue (`src/lib/telemetry.ts`): a localStorage-backed FIFO that
  replays on the `online` event (48h retention, capped, drops non-retryable 4xx). Not a TanStack
  mutation and not Workbox background sync — the queue is app-level so it survives reloads.
- `attemptNo` increments on each retry of the same item before it's correct.
- Do **not** block the UI on the network — optimistic, background-synced.

---

## 5. Voice playback

- If `ex.audioUrl` present → play it (`syllableAudio[i]` is the slot for future syllable-wise playback).
- Else fall back to **Web Speech API** (`SpeechSynthesisUtterance`, `lang='de-DE'`, `rate≈0.75` —
  clear-speech evidence, `content/academia/DUOLINGO_ROADMAP.md` §C.2).
- Respect `settings.soundOn`. Gate audio init behind first user gesture (mobile autoplay rules).

---

## 6. Accessibility & settings

Driven by the profile's settings (read from the `GET /me` probe — `GET /profiles/{id}` exists but the
app doesn't use it; edited via `PATCH /profiles/{id}/settings`):
- `dyslexicFont` → currently toggles **extra letter/word spacing** on the (already dyslexia-friendly)
  Atkinson Hyperlegible body font. Shipping the actual **OpenDyslexic** face is a follow-up; until then the
  setting is spacing-only (don't relabel it as a font swap in the UI).
- `fontScale` → root font-size multiplier.
- `soundOn` → master audio toggle.
- `appearance` → night mode: `'auto' | 'light' | 'dark'` (default `auto` = follow the OS
  `prefers-color-scheme`), edited on `/profil` ("Aussehen": Hell / Dunkel / Automatisch).
  **Mechanism** (`features/settings/theme.ts` + `A11yProvider`): the *mode* is persisted on the
  profile and mirrored to `localStorage['blsb.appearance']`; the DOM only carries the *resolved*
  theme as `html[data-theme='light'|'dark']`, which `index.css` maps to a dark override block over
  the `@theme` color tokens (see the semantic tokens: surface/hairline/wash/track/gold/*-text).
  An inline **boot script in `index.html`** resolves the mirror pre-paint (no light flash; also
  themes the pre-auth screens, which render outside `A11yProvider`), and while `auto` a
  `matchMedia` listener follows live OS changes. The `theme-color` meta is updated at runtime; the
  PWA manifest splash stays brand-light (W3C manifest has no dark variant — accepted).
- High contrast, large tap targets, keyboard operability throughout (students + assistive use).

`/profil` edits every profile setting: name, buddy, `soundOn`, `appearance`, `fontScale`
("Schriftgröße" presets Normal/Groß/Sehr groß = 1.0/1.25/1.5), `dyslexicFont` ("Extra Abstand
beim Lesen" — spacing-only wording, see above), and `goal` ("Wochenziel", same presets as
onboarding — `lib/constants.ts GOALS`).

---

## 7. API client & data flow

Single typed `api.ts` wrapping `fetch`, base URL from `VITE_API_BASE`, `credentials:'include'` so the
backend's **httpOnly session cookie** rides along (auth is derived from a `/me` probe — no token in
JS, no Bearer header anywhere). **Mirror the backend contract exactly** (`../backend/SPEC.md` §6).
Endpoints consumed:

```
POST /auth/request-code        POST /auth/verify          POST /auth/logout
GET  /me                       POST /profiles            PATCH /profiles/{id}/settings
GET  /units                    POST /sessions            POST /attempts        POST /sessions/{id}/complete
GET  /progress/{id}            GET  /assignments          # open staff-assigned lectures (§H1)
GET  /chat/{id}                POST /chat/{id}            # history messages may carry imageUrl (homework bubbles)
POST /homework                 GET  /homework/{id}        # no /confirm — staff trainer is the human gate (§9)
POST /profiles/{id}/reset      POST /profiles/{id}/reset-chat                  # destructive — §8
```

TanStack Query keys: `['me']`, `['units']`, `['session', id]`, `['progress', profileId]`,
`['chat', profileId]`, `['assignments', profileId]` (the assignments query alone opts back into
`refetchOnWindowFocus` so a fresh assignment appears when the student returns to the app).
Invalidate `['me']` (stars/streak) + `['progress']` + `['units']` + `['assignments']` after
`/sessions/{id}/complete`.

**Types are generated, never hand-written.** `src/lib/api.gen.ts` is produced from the backend OpenAPI via
`npm run gen:api` (`openapi-typescript`) and **committed**; CI re-runs it and fails on any diff (the contract
drift gate). Never hand-edit `api.gen.ts` — change the backend Zod schema and regenerate. `api.ts` is the
hand-written transport wrapper on top of those types.

**429 handling:** ★ ops are free but capped per day (backend `LLM_SESSIONS_PER_DAY` / `CHAT_MESSAGES_PER_DAY`).
Over cap the backend returns `429 RATE_LIMITED` with a kindgerechte message — surface it through the normal
error paths (the message is written for the student); no special routing. Nothing in this app emits or handles 402.

---

## 8. Verwaltung (destructive actions in `/profil`)

There is no parent area and no PIN. The two destructive actions live in the `/profil` tab under
**Verwaltung**, each fronted by a **two-step confirmation** (action → "Wirklich …?" →
"Bist du ganz sicher? Das kann nicht rückgängig gemacht werden.") — deliberate friction, since anyone
holding the family session can trigger them:

- **Lernfortschritt zurücksetzen** → `POST /profiles/{id}/reset` — wipes attempts/plan/stars; name +
  settings kept. Invalidate `['me']`, `['progress']`, `['units']`.
- **Chat löschen** → `POST /profiles/{id}/reset-chat` — wipes the whole conversation incl. homework
  photos; learning progress kept. Invalidate `['chat']`.
- **No billing.** The app is free (approval-gated, ARCHITECTURE §1b/§9); there is no supporter/credit UI.
- No engagement/streak-pressure mechanics tied to anything monetary, anywhere.

---

## 9. Homework "Foto & verbessern" flow (in the Chat tab)

The human gate is a **trained professional (staff trainer)**, not the parent — see `../ARCHITECTURE.md` §11
and `../backend/SPEC.md` §10. This `-web` app **uploads and tracks status only**; it never shows the raw LLM
draft and has **no confirm/edit UI** (the trainer portal `-trainer` owns that, and is not part of this repo).

1. The 📷 button next to the chat input opens the camera/picker → `POST /homework` (multipart). The photo
   appears as a chat message (the backend serves it back as a durable bubble in `/chat` history). Consent
   copy states the photo is reviewed by a trained professional ("eine Fachkraft") to tailor lessons.
2. `GET /homework/{id}` is polled (with backoff) while in review; the trainer's status bubble reflects
   `pending_analysis` / `pending_review` → `reviewed` / `rejected`. Never display a draft state.
3. On `reviewed`, the status bubble carries the **authoritative** result (topic + suggested focus from
   `reviewedAnalysis`) — read-only, no accept/reject.
4. The validated focus shapes the **next** generated lecture; surface that session in `/lernen` when it
   appears. There is no family confirm step and the student is never blocked while a photo is in review.
- Student handwriting OCR is unreliable → the mandatory human gate is the **staff trainer**, whose verdict
  is authoritative (there is no parent-confirm step). The upload is not PIN-gated — it lives in the
  student-facing chat by product decision; the professional-in-the-loop pipeline is unchanged.

---

## 10. Env & build
```
VITE_API_BASE=        # backend URL (required for production builds)
```
- `VITE_APP_VERSION` is **not** an env var — it's injected at build by `vite.config.ts` (`define`)
  as `<package version>+<commit>`; deploy sets `GIT_COMMIT`, local builds read the git HEAD.
- PWA manifest: app name, the prototype's "b" mark icon (teal #27A99B), maskable icons, standalone display.
- PWA updates are **prompt-to-update**: `UpdatePrompt.tsx` shows "Neue Version verfügbar – neu laden?"
  in the shell, suppressed while a lesson is running; the SW never activates silently.
- Mobile-first responsive; test at 390px and tablet widths.

## 11. Acceptance checks
- Every answered item produces exactly one `/attempts` call with a sane `timeMs`.
- App renders every exercise type in the current contract (currently just `placeholder`) from
  backend-served JSON with no hardcoded lesson data.
- `dyslexicFont` + `fontScale` visibly change rendering and are editable on `/profil` (§6);
  `soundOn` mutes all audio.
- `appearance` switches the whole app light/dark (incl. pre-auth screens via the boot script);
  `Automatisch` follows a live OS scheme change without reload.
- No price/paywall/buy control exists anywhere in the app.
- Works installed as a PWA; attempts queue and sync after an offline blip.
